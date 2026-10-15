package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const uploadDir = "./uploads"

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

func UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "missing file")
		return
	}
	defer file.Close()

	// Determine extension from Content-Type header, fall back to sniffing.
	ct := header.Header.Get("Content-Type")
	if idx := strings.Index(ct, ";"); idx != -1 {
		ct = strings.TrimSpace(ct[:idx])
	}
	ext, ok := allowedImageTypes[ct]
	if !ok {
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		detected := http.DetectContentType(buf[:n])
		ext, ok = allowedImageTypes[detected]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "unsupported image type"})
			return
		}
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		common.ApiError(c, err)
		return
	}

	filename := uuid.NewString() + ext
	dst := filepath.Join(uploadDir, filename)

	// Open a fresh handle (multipart form is cached; second Open starts at byte 0).
	file2, _, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer file2.Close()

	outFile, err := os.Create(dst)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, file2); err != nil {
		common.ApiError(c, err)
		return
	}

	base := strings.TrimRight(system_setting.ServerAddress, "/")
	url := fmt.Sprintf("%s/uploads/%s", base, filename)

	common.ApiSuccess(c, gin.H{"url": url})
}
