package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	customVideoPollInterval = 3 * time.Second
	customVideoTaskTimeout  = 5 * time.Minute
	customVideoRequestLimit = 1 << 20
)

type customVideoRequest struct {
	Model       string `json:"model"`
	APIURL      string `json:"apiUrl"`
	APIKey      string `json:"apiKey"`
	Prompt      string `json:"prompt"`
	Duration    int    `json:"duration"`
	AspectRatio string `json:"aspectRatio"`
	Resolution  string `json:"resolution"`
	ImageURL    string `json:"imageUrl"`
}

type customVideoTask struct {
	ID        string  `json:"taskId"`
	UserID    int     `json:"-"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress"`
	VideoURL  string  `json:"videoUrl,omitempty"`
	Error     string  `json:"error,omitempty"`
	SubmitURL string  `json:"-"`
	BaseURL   string  `json:"-"`
	APIKey    string  `json:"-"`
	RequestID string  `json:"-"`
}

type customVideoUpstreamResponse struct {
	ID        string  `json:"id"`
	RequestID string  `json:"request_id"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress"`
	Video     *struct {
		URL string `json:"url"`
	} `json:"video"`
	URL      string                       `json:"url"`
	VideoURL string                       `json:"video_url"`
	Data     *customVideoUpstreamResponse `json:"data"`
	Result   *customVideoUpstreamResponse `json:"result"`
	Output   *customVideoUpstreamResponse `json:"output"`
	Error    json.RawMessage              `json:"error"`
	Message  string                       `json:"message"`
}

var customVideoTasks = struct {
	sync.RWMutex
	items map[string]*customVideoTask
}{items: make(map[string]*customVideoTask)}

func CreateCustomVideoGeneration(c *gin.Context) {
	var input customVideoRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	input.Model = strings.TrimSpace(input.Model)
	input.APIKey = strings.TrimSpace(input.APIKey)
	input.Prompt = strings.TrimSpace(input.Prompt)
	input.ImageURL = strings.TrimSpace(strings.Trim(strings.TrimSpace(input.ImageURL), "`"))
	if input.Model == "" || input.APIKey == "" || input.Prompt == "" || input.Duration <= 0 || input.AspectRatio == "" || input.Resolution == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing required video parameters"})
		return
	}

	submitURL, baseURL, err := normalizeAndValidateCustomVideoURL(c.Request.Context(), input.APIURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task := &customVideoTask{
		ID:        uuid.NewString(),
		UserID:    c.GetInt("id"),
		Status:    "queued",
		Progress:  0,
		SubmitURL: submitURL,
		BaseURL:   baseURL,
		APIKey:    input.APIKey,
	}
	customVideoTasks.Lock()
	customVideoTasks.items[task.ID] = task
	customVideoTasks.Unlock()

	input.APIKey = ""
	go runCustomVideoTask(task.ID, input)
	c.JSON(http.StatusAccepted, gin.H{"taskId": task.ID})
}

func GetCustomVideoGeneration(c *gin.Context) {
	customVideoTasks.RLock()
	task, ok := customVideoTasks.items[c.Param("task_id")]
	if !ok || task.UserID != c.GetInt("id") {
		customVideoTasks.RUnlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "video task not found"})
		return
	}
	result := customVideoTask{
		ID:       task.ID,
		Status:   task.Status,
		Progress: task.Progress,
		VideoURL: task.VideoURL,
		Error:    task.Error,
	}
	customVideoTasks.RUnlock()
	c.JSON(http.StatusOK, result)
}

func runCustomVideoTask(taskID string, input customVideoRequest) {
	ctx, cancel := context.WithTimeout(context.Background(), customVideoTaskTimeout)
	defer cancel()

	setCustomVideoTask(taskID, func(task *customVideoTask) {
		task.Status = "processing"
	})

	client := newCustomVideoHTTPClient()
	requestID, err := submitCustomVideo(ctx, client, taskID, input)
	if err != nil {
		failCustomVideoTask(taskID, err)
		return
	}
	setCustomVideoTask(taskID, func(task *customVideoTask) {
		task.RequestID = requestID
	})

	ticker := time.NewTicker(customVideoPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			failCustomVideoTask(taskID, errors.New("video generation timed out"))
			return
		case <-ticker.C:
			finished, err := pollCustomVideo(ctx, client, taskID, requestID)
			if err != nil {
				failCustomVideoTask(taskID, err)
				return
			}
			if finished {
				return
			}
		}
	}
}

func customVideoSize(resolution, aspectRatio string) string {
	short := 720
	if resolution == "1080p" {
		short = 1080
	}

	switch aspectRatio {
	case "9:16":
		return fmt.Sprintf("%dx%d", short, short*16/9)
	case "1:1":
		return fmt.Sprintf("%dx%d", short, short)
	default:
		return fmt.Sprintf("%dx%d", short*16/9, short)
	}
}

func submitCustomVideo(ctx context.Context, client *http.Client, taskID string, input customVideoRequest) (string, error) {
	payload := map[string]any{
		"model":   input.Model,
		"prompt":  input.Prompt,
		"seconds": strconv.Itoa(input.Duration),
		"size":    customVideoSize(input.Resolution, input.AspectRatio),
	}
	if input.ImageURL != "" {
		payload["image_url"] = input.ImageURL
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	customVideoTasks.RLock()
	task, ok := customVideoTasks.items[taskID]
	if !ok {
		customVideoTasks.RUnlock()
		return "", errors.New("video task not found")
	}
	submitURL := task.SubmitURL
	customVideoTasks.RUnlock()

	response, err := doCustomVideoRequest(ctx, client, taskID, http.MethodPost, submitURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	requestID := strings.TrimSpace(response.RequestID)
	if requestID == "" {
		requestID = strings.TrimSpace(response.ID)
	}
	if requestID == "" {
		if message := upstreamErrorMessage(response); message != "" {
			return "", errors.New(message)
		}
		return "", errors.New("upstream did not return id or request_id")
	}
	return requestID, nil
}

func customVideoResultURL(response *customVideoUpstreamResponse) string {
	if response == nil {
		return ""
	}
	candidates := []string{response.VideoURL, response.URL}
	if response.Video != nil {
		candidates = append(candidates, response.Video.URL)
	}
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(strings.Trim(strings.TrimSpace(candidate), "`"))
		if candidate != "" {
			return candidate
		}
	}
	for _, nested := range []*customVideoUpstreamResponse{response.Data, response.Result, response.Output} {
		if candidate := customVideoResultURL(nested); candidate != "" {
			return candidate
		}
	}
	return ""
}

func pollCustomVideo(ctx context.Context, client *http.Client, taskID, requestID string) (bool, error) {
	customVideoTasks.RLock()
	task, ok := customVideoTasks.items[taskID]
	if !ok {
		customVideoTasks.RUnlock()
		return false, errors.New("video task not found")
	}
	queryURL := strings.TrimRight(task.SubmitURL, "/") + "/" + url.PathEscape(requestID)
	customVideoTasks.RUnlock()

	response, err := doCustomVideoRequest(ctx, client, taskID, http.MethodGet, queryURL, nil)
	if err != nil {
		return false, err
	}

	status := strings.ToLower(strings.TrimSpace(response.Status))
	switch status {
	case "done", "succeeded", "completed", "success":
		videoURL := customVideoResultURL(response)
		if videoURL == "" {
			return false, fmt.Errorf("upstream task completed without a video URL (id=%s, status=%s)", requestID, response.Status)
		}
		setCustomVideoTask(taskID, func(task *customVideoTask) {
			task.Status = "done"
			task.Progress = 100
			task.VideoURL = videoURL
			task.APIKey = ""
		})
		return true, nil
	case "failed", "error", "cancelled", "canceled":
		message := upstreamErrorMessage(response)
		if message == "" {
			message = "upstream video generation failed"
		}
		return false, errors.New(message)
	default:
		setCustomVideoTask(taskID, func(task *customVideoTask) {
			task.Status = "processing"
			if response.Progress >= 0 && response.Progress <= 100 {
				task.Progress = response.Progress
			}
		})
		return false, nil
	}
}

func doCustomVideoRequest(ctx context.Context, client *http.Client, taskID, method, requestURL string, body io.Reader) (*customVideoUpstreamResponse, error) {
	customVideoTasks.RLock()
	task, ok := customVideoTasks.items[taskID]
	if !ok {
		customVideoTasks.RUnlock()
		return nil, errors.New("video task not found")
	}
	apiKey := task.APIKey
	customVideoTasks.RUnlock()

	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, customVideoRequestLimit+1))
	if err != nil {
		return nil, errors.New("failed to read upstream response")
	}
	if len(data) > customVideoRequestLimit {
		return nil, errors.New("upstream response is too large")
	}

	var result customVideoUpstreamResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("upstream returned non-JSON response (HTTP %d)", resp.StatusCode)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		message := upstreamErrorMessage(&result)
		if message == "" {
			message = fmt.Sprintf("upstream request failed with HTTP %d", resp.StatusCode)
		}
		return nil, errors.New(message)
	}
	return &result, nil
}

// normalizeAndValidateCustomVideoURL 接受用户填写的完整提交 URL，
// 返回可直接请求的提交 URL，以及仅含协议+域名的 base URL（用于轮询查询）。
func normalizeAndValidateCustomVideoURL(ctx context.Context, rawURL string) (string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", "", errors.New("invalid API URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", "", errors.New("API URL must use http or https")
	}
	if parsed.User != nil {
		return "", "", errors.New("API URL must not contain userinfo")
	}
	if parsed.Fragment != "" {
		return "", "", errors.New("API URL must not contain a fragment")
	}
	if err := validateCustomVideoHost(ctx, parsed.Hostname()); err != nil {
		return "", "", err
	}

	// 完整提交 URL：保留用户填写的完整路径，仅去掉尾部斜杠
	submitURL := parsed.String()
	if parsed.RawQuery == "" && parsed.Fragment == "" {
		submitURL = strings.TrimRight(submitURL, "/")
	}

	// base URL：仅协议+主机，用于拼接轮询查询地址
	base := &url.URL{Scheme: parsed.Scheme, Host: parsed.Host}
	baseURL := strings.TrimRight(base.String(), "/")

	return submitURL, baseURL, nil
}

func validateCustomVideoHost(ctx context.Context, hostname string) error {
	hostname = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(hostname)), ".")
	if hostname == "" || hostname == "localhost" || strings.HasSuffix(hostname, ".localhost") {
		return errors.New("API URL host is not allowed")
	}
	if ip := net.ParseIP(hostname); ip != nil {
		if !isPublicCustomVideoIP(ip) {
			return errors.New("API URL resolves to a private or local address")
		}
		return nil
	}

	lookupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupIPAddr(lookupCtx, hostname)
	if err != nil || len(addresses) == 0 {
		return errors.New("API URL host could not be resolved")
	}
	for _, address := range addresses {
		if !isPublicCustomVideoIP(address.IP) {
			return errors.New("API URL resolves to a private or local address")
		}
	}
	return nil
}

func isPublicCustomVideoIP(ip net.IP) bool {
	return ip != nil && !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() &&
		!ip.IsLinkLocalMulticast() && !ip.IsUnspecified() && !ip.IsMulticast()
}

func newCustomVideoHTTPClient() *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport := &http.Transport{
		Proxy:                 nil,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		IdleConnTimeout:       30 * time.Second,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			addresses, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil || len(addresses) == 0 {
				return nil, errors.New("upstream host could not be resolved")
			}
			for _, resolved := range addresses {
				if !isPublicCustomVideoIP(resolved.IP) {
					return nil, errors.New("upstream host resolved to a private or local address")
				}
			}
			var lastErr error
			for _, resolved := range addresses {
				conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(resolved.IP.String(), port))
				if dialErr == nil {
					return conn, nil
				}
				lastErr = dialErr
			}
			return nil, lastErr
		},
	}
	return &http.Client{
		Transport: transport,
		Timeout:   45 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errors.New("upstream redirects are not allowed")
		},
	}
}

func upstreamErrorMessage(response *customVideoUpstreamResponse) string {
	if response == nil {
		return ""
	}
	if len(response.Error) > 0 && string(response.Error) != "null" {
		var message string
		if json.Unmarshal(response.Error, &message) == nil && message != "" {
			return message
		}
		var detail struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(response.Error, &detail) == nil && detail.Message != "" {
			return detail.Message
		}
	}
	return response.Message
}

func setCustomVideoTask(taskID string, update func(*customVideoTask)) {
	customVideoTasks.Lock()
	defer customVideoTasks.Unlock()
	if task, ok := customVideoTasks.items[taskID]; ok {
		update(task)
	}
}

func failCustomVideoTask(taskID string, err error) {
	setCustomVideoTask(taskID, func(task *customVideoTask) {
		task.Status = "failed"
		task.Error = err.Error()
		task.APIKey = ""
	})
}
