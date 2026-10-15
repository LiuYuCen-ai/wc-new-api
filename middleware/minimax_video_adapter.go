package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

// MiniMaxVideoRequestConvert maps MiniMax official video paths onto the
// unified task relay:
//
//	POST /v2/video_generation
//	GET  /v2/query/video_generation/:task_id
//	POST /v1/video_generation
//	GET  /v1/query/video_generation?task_id=
func MiniMaxVideoRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet {
			taskID := strings.TrimSpace(c.Param("task_id"))
			if taskID == "" {
				taskID = strings.TrimSpace(c.Query("task_id"))
			}
			if taskID == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "task_id is required")
				return
			}
			c.Request.URL.Path = "/v1/video/generations/" + taskID
			c.Set("task_id", taskID)
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
			c.Next()
			return
		}

		var originalReq map[string]interface{}
		if err := common.UnmarshalBodyReusable(c, &originalReq); err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "Invalid request body")
			return
		}

		model, _ := originalReq["model"].(string)
		prompt := extractMiniMaxVideoPrompt(originalReq)
		if strings.TrimSpace(model) == "" {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "model is required")
			return
		}
		if strings.TrimSpace(prompt) == "" {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "content must include a non-empty text item")
			return
		}

		unifiedReq := map[string]interface{}{
			"model":    model,
			"prompt":   prompt,
			"metadata": originalReq,
		}
		if resolution, ok := originalReq["resolution"].(string); ok && strings.TrimSpace(resolution) != "" {
			unifiedReq["resolution"] = resolution
		}
		if duration, ok := asPositiveInt(originalReq["duration"]); ok {
			unifiedReq["duration"] = duration
		}
		if images := extractMiniMaxVideoImages(originalReq); len(images) > 0 {
			unifiedReq["images"] = images
			unifiedReq["image"] = images[0]
		}

		jsonData, err := json.Marshal(unifiedReq)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "Failed to marshal request body")
			return
		}

		// UnmarshalBodyReusable caches the original body in KeyBodyStorage; clear it
		// so downstream validation reads the rewritten unified payload.
		common.CleanupBodyStorage(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
		c.Set(common.KeyRequestBody, jsonData)
		c.Request.URL.Path = "/v1/video/generations"
		if _, hasImage := unifiedReq["image"]; !hasImage {
			c.Set("action", constant.TaskActionTextGenerate)
		}
		c.Next()
	}
}

func extractMiniMaxVideoPrompt(originalReq map[string]interface{}) string {
	if prompt, ok := originalReq["prompt"].(string); ok && strings.TrimSpace(prompt) != "" {
		return strings.TrimSpace(prompt)
	}
	content, ok := originalReq["content"].([]interface{})
	if !ok {
		return ""
	}
	for _, raw := range content {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		typeName, _ := item["type"].(string)
		if typeName != "text" {
			continue
		}
		if text, ok := item["text"].(string); ok && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text)
		}
	}
	return ""
}

func extractMiniMaxVideoImages(originalReq map[string]interface{}) []string {
	if image, ok := originalReq["first_frame_image"].(string); ok && strings.TrimSpace(image) != "" {
		images := []string{strings.TrimSpace(image)}
		if last, ok := originalReq["last_frame_image"].(string); ok && strings.TrimSpace(last) != "" {
			images = append(images, strings.TrimSpace(last))
		}
		return images
	}

	content, ok := originalReq["content"].([]interface{})
	if !ok {
		return nil
	}
	var firstFrame, lastFrame string
	var images []string
	for _, raw := range content {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		typeName, _ := item["type"].(string)
		if typeName != "image_url" {
			continue
		}
		url := ""
		if imageURL, ok := item["image_url"].(map[string]interface{}); ok {
			url, _ = imageURL["url"].(string)
		}
		url = strings.TrimSpace(url)
		if url == "" {
			continue
		}
		role, _ := item["role"].(string)
		switch role {
		case "last_frame":
			lastFrame = url
		case "first_frame", "":
			if firstFrame == "" {
				firstFrame = url
			} else {
				images = append(images, url)
			}
		default:
			images = append(images, url)
		}
	}
	out := make([]string, 0, 2+len(images))
	if firstFrame != "" {
		out = append(out, firstFrame)
	}
	if lastFrame != "" {
		out = append(out, lastFrame)
	}
	out = append(out, images...)
	return out
}

func asPositiveInt(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case float64:
		if typed > 0 {
			return int(typed), true
		}
	case int:
		if typed > 0 {
			return typed, true
		}
	case int64:
		if typed > 0 {
			return int(typed), true
		}
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil && parsed > 0 {
			return int(parsed), true
		}
	}
	return 0, false
}
