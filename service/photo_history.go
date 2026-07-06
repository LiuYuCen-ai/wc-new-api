package service

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/google/uuid"
)

const (
	photoHistoryDirName   = "photo-history"
	maxPhotoImageBytes    = 20 << 20 // 20MB
	photoImageDownloadTO  = 30 * time.Second
)

func GetPhotoHistoryRootDir() string {
	if custom := strings.TrimSpace(os.Getenv("PHOTO_HISTORY_DATA_DIR")); custom != "" {
		return custom
	}

	sqlitePath := strings.TrimSpace(common.SQLitePath)
	if sqlitePath != "" && !strings.Contains(sqlitePath, "@") {
		sqlitePath = strings.SplitN(sqlitePath, "?", 2)[0]
		if dir := filepath.Dir(sqlitePath); dir != "" && dir != "." {
			return filepath.Join(dir, photoHistoryDirName)
		}
	}

	if cachePath := strings.TrimSpace(common.GetDiskCachePath()); cachePath != "" {
		return filepath.Join(cachePath, photoHistoryDirName)
	}

	if wd, err := os.Getwd(); err == nil && wd != "" {
		return filepath.Join(wd, photoHistoryDirName)
	}

	return photoHistoryDirName
}

func SavePhotoHistoryImage(userId int, input model.PhotoHistoryImageInput) (string, string, error) {
	b64 := strings.TrimSpace(input.B64)
	imageURL := strings.TrimSpace(input.URL)

	if b64 == "" && imageURL == "" {
		return "", "", errors.New("image payload is empty")
	}

	var (
		data     []byte
		mimeType string
		ext      string
		err      error
	)

	switch {
	case b64 != "":
		data, mimeType, ext, err = decodePhotoImageBase64(b64, input.MimeType)
	case strings.HasPrefix(imageURL, "data:"):
		data, mimeType, ext, err = decodePhotoImageDataURL(imageURL)
	default:
		data, mimeType, ext, err = downloadPhotoImage(imageURL)
	}
	if err != nil {
		return "", "", err
	}
	if len(data) == 0 {
		return "", "", errors.New("image payload is empty")
	}
	if len(data) > maxPhotoImageBytes {
		return "", "", fmt.Errorf("image exceeds %d bytes", maxPhotoImageBytes)
	}

	if mimeType == "" {
		mimeType = "image/png"
	}
	if ext == "" {
		ext = extensionForMimeType(mimeType)
	}

	userDir := filepath.Join(GetPhotoHistoryRootDir(), fmt.Sprintf("%d", userId))
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", "", err
	}

	filename := uuid.NewString() + ext
	absolutePath := filepath.Join(userDir, filename)
	if err := os.WriteFile(absolutePath, data, 0o600); err != nil {
		return "", "", err
	}

	relativePath := filepath.ToSlash(filepath.Join(fmt.Sprintf("%d", userId), filename))
	return relativePath, mimeType, nil
}

func RemovePhotoHistoryImage(storagePath string) {
	storagePath = strings.TrimSpace(storagePath)
	if storagePath == "" {
		return
	}
	absolutePath := filepath.Join(GetPhotoHistoryRootDir(), filepath.FromSlash(storagePath))
	_ = os.Remove(absolutePath)
}

func RemovePhotoHistoryImages(images []model.PhotoGenerationImage) {
	for _, image := range images {
		RemovePhotoHistoryImage(image.StoragePath)
	}
}

func OpenPhotoHistoryImage(storagePath string) (*os.File, string, error) {
	storagePath = strings.TrimSpace(storagePath)
	if storagePath == "" {
		return nil, "", errors.New("image not found")
	}

	root := filepath.Clean(GetPhotoHistoryRootDir())
	absolutePath := filepath.Clean(filepath.Join(root, filepath.FromSlash(storagePath)))
	if !strings.HasPrefix(absolutePath, root+string(os.PathSeparator)) && absolutePath != root {
		return nil, "", errors.New("invalid image path")
	}

	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, "", err
	}

	return file, mimeTypeFromPath(absolutePath), nil
}

func decodePhotoImageBase64(encoded string, mimeType string) ([]byte, string, string, error) {
	if idx := strings.Index(encoded, ","); idx >= 0 && strings.HasPrefix(strings.ToLower(encoded[:idx]), "data:") {
		return decodePhotoImageDataURL(encoded)
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		data, err = base64.RawStdEncoding.DecodeString(encoded)
	}
	if err != nil {
		return nil, "", "", err
	}

	mimeType = strings.TrimSpace(mimeType)
	if mimeType == "" {
		mimeType = "image/png"
	}
	return data, mimeType, extensionForMimeType(mimeType), nil
}

func decodePhotoImageDataURL(dataURL string) ([]byte, string, string, error) {
	comma := strings.Index(dataURL, ",")
	if comma < 0 {
		return nil, "", "", errors.New("invalid data url")
	}

	meta := dataURL[:comma]
	payload := dataURL[comma+1:]
	mimeType := "image/png"
	if strings.HasPrefix(meta, "data:") {
		mimePart := strings.TrimSuffix(strings.TrimPrefix(meta, "data:"), ";base64")
		if mimePart != "" {
			mimeType = mimePart
		}
	}

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", "", err
	}
	return data, mimeType, extensionForMimeType(mimeType), nil
}

func downloadPhotoImage(imageURL string) ([]byte, string, string, error) {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		imageURL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return nil, "", "", err
	}

	baseClient := GetHttpClient()
	transport := http.DefaultTransport
	checkRedirectFn := checkRedirect
	if baseClient != nil {
		if baseClient.Transport != nil {
			transport = baseClient.Transport
		}
		if baseClient.CheckRedirect != nil {
			checkRedirectFn = baseClient.CheckRedirect
		}
	}
	client := &http.Client{
		Transport:     transport,
		Timeout:       photoImageDownloadTO,
		CheckRedirect: checkRedirectFn,
	}

	req, err := http.NewRequest(http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("download image failed with status %d", resp.StatusCode)
	}

	limited := io.LimitReader(resp.Body, maxPhotoImageBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, "", "", err
	}
	if len(data) > maxPhotoImageBytes {
		return nil, "", "", fmt.Errorf("image exceeds %d bytes", maxPhotoImageBytes)
	}

	mimeType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if semi := strings.Index(mimeType, ";"); semi >= 0 {
		mimeType = mimeType[:semi]
	}
	if mimeType == "" {
		mimeType = "image/png"
	}

	return data, mimeType, extensionForMimeType(mimeType), nil
}

func extensionForMimeType(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}

func mimeTypeFromPath(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "image/png"
	}
}
