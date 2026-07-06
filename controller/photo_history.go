package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type photoHistoryImageDTO struct {
	ID            string `json:"id"`
	MimeType      string `json:"mime_type"`
	URL           string `json:"url"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

type photoHistoryDTO struct {
	ID               string                 `json:"id"`
	Prompt           string                 `json:"prompt"`
	Model            string                 `json:"model"`
	Status           string                 `json:"status"`
	CreatedAt        int64                  `json:"created_at"`
	UpdatedAt        int64                  `json:"updated_at"`
	GenerationParams any                    `json:"generation_params,omitempty"`
	Images           []photoHistoryImageDTO `json:"images"`
}

func GetPhotoHistory(c *gin.Context) {
	userId := c.GetInt("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(model.PhotoHistoryPerUserLimit)))

	histories, err := model.ListPhotoGenerationHistories(userId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]photoHistoryDTO, 0, len(histories))
	for _, history := range histories {
		items = append(items, toPhotoHistoryDTO(history))
	}

	common.ApiSuccess(c, items)
}

func CreatePhotoHistory(c *gin.Context) {
	userId := c.GetInt("id")

	var input model.PhotoHistoryCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiError(c, err)
		return
	}

	history, pruned, err := model.CreatePhotoGenerationHistory(userId, input, service.SavePhotoHistoryImage)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	for _, item := range pruned {
		service.RemovePhotoHistoryImages(item.Images)
	}

	common.ApiSuccess(c, toPhotoHistoryDTO(*history))
}

func AppendPhotoHistoryImages(c *gin.Context) {
	userId := c.GetInt("id")
	historyID := c.Param("id")

	var input model.PhotoHistoryAppendInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiError(c, err)
		return
	}

	history, err := model.AppendPhotoGenerationImages(userId, historyID, input, service.SavePhotoHistoryImage)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "history not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, toPhotoHistoryDTO(*history))
}

func DeletePhotoHistory(c *gin.Context) {
	userId := c.GetInt("id")
	historyID := c.Param("id")

	history, err := model.DeletePhotoGenerationHistory(userId, historyID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "history not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	service.RemovePhotoHistoryImages(history.Images)
	common.ApiSuccess(c, nil)
}

func GetPhotoHistoryImage(c *gin.Context) {
	userId := c.GetInt("id")
	imageID := c.Param("imageId")

	image, err := model.GetPhotoGenerationImageByPublicID(userId, imageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		common.ApiError(c, err)
		return
	}

	file, mimeType, err := service.OpenPhotoHistoryImage(image.StoragePath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()

	if image.MimeType != "" {
		mimeType = image.MimeType
	}

	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	c.DataFromReader(http.StatusOK, -1, mimeType, file, nil)
}

func toPhotoHistoryDTO(history model.PhotoGenerationHistory) photoHistoryDTO {
	dto := photoHistoryDTO{
		ID:        history.PublicId,
		Prompt:    history.Prompt,
		Model:     history.Model,
		Status:    history.Status,
		CreatedAt: history.CreatedAt,
		UpdatedAt: history.UpdatedAt,
		Images:    make([]photoHistoryImageDTO, 0, len(history.Images)),
	}
	if dto.Status == "" {
		dto.Status = model.PhotoHistoryStatusReady
	}

	if len(history.GenerationParams) > 0 {
		_ = common.Unmarshal(history.GenerationParams, &dto.GenerationParams)
	}

	for _, image := range history.Images {
		dto.Images = append(dto.Images, photoHistoryImageDTO{
			ID:            image.PublicId,
			MimeType:      image.MimeType,
			URL:           "/api/photo/images/" + image.PublicId,
			RevisedPrompt: image.RevisedPrompt,
		})
	}

	return dto
}
