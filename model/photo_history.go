package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const PhotoHistoryPerUserLimit = 50

const (
	PhotoHistoryStatusPending = "pending"
	PhotoHistoryStatusReady   = "ready"
	PhotoHistoryStatusFailed  = "failed"
)

type PhotoGenerationHistory struct {
	Id               int64                  `json:"-" gorm:"primaryKey;autoIncrement"`
	PublicId         string                 `json:"id" gorm:"type:varchar(36);uniqueIndex;not null"`
	UserId           int                    `json:"-" gorm:"index;not null"`
	Prompt           string                 `json:"prompt" gorm:"type:text"`
	Model            string                 `json:"model" gorm:"type:varchar(128)"`
	Status           string                 `json:"status" gorm:"type:varchar(16);default:ready;index"`
	GenerationParams json.RawMessage        `json:"generation_params,omitempty" gorm:"type:json"`
	CreatedAt        int64                  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt        int64                  `json:"updated_at" gorm:"bigint"`
	Images           []PhotoGenerationImage `json:"images" gorm:"foreignKey:HistoryId;constraint:OnDelete:CASCADE"`
}

type PhotoGenerationImage struct {
	Id            int64  `json:"-" gorm:"primaryKey;autoIncrement"`
	PublicId      string `json:"id" gorm:"type:varchar(36);uniqueIndex;not null"`
	HistoryId     int64  `json:"-" gorm:"index;not null"`
	UserId        int    `json:"-" gorm:"index;not null"`
	SortOrder     int    `json:"sort_order"`
	MimeType      string `json:"mime_type" gorm:"type:varchar(64)"`
	StoragePath   string `json:"-" gorm:"type:varchar(512)"`
	SourceURL     string `json:"-" gorm:"type:text"`
	RevisedPrompt string `json:"revised_prompt,omitempty" gorm:"type:text"`
}

func (PhotoGenerationHistory) TableName() string {
	return "photo_generation_histories"
}

func (PhotoGenerationImage) TableName() string {
	return "photo_generation_images"
}

type PhotoHistoryImageInput struct {
	B64           string `json:"b64"`
	URL           string `json:"url"`
	MimeType      string `json:"mime_type"`
	RevisedPrompt string `json:"revised_prompt"`
}

type PhotoHistoryCreateInput struct {
	PublicId         string                   `json:"id"`
	Prompt           string                   `json:"prompt"`
	Model            string                   `json:"model"`
	Status           string                   `json:"status"`
	GenerationParams json.RawMessage          `json:"generation_params"`
	Images           []PhotoHistoryImageInput `json:"images"`
}

type PhotoHistoryAppendInput struct {
	Prompt string                   `json:"prompt"`
	Images []PhotoHistoryImageInput `json:"images"`
}

func normalizePhotoHistoryPublicID(publicID string) string {
	publicID = strings.TrimSpace(publicID)
	if publicID == "" {
		return uuid.NewString()
	}
	if _, err := uuid.Parse(publicID); err != nil {
		return uuid.NewString()
	}
	return publicID
}

func ListPhotoGenerationHistories(userId int, limit int) ([]PhotoGenerationHistory, error) {
	if limit <= 0 {
		limit = PhotoHistoryPerUserLimit
	}
	if limit > PhotoHistoryPerUserLimit {
		limit = PhotoHistoryPerUserLimit
	}

	var histories []PhotoGenerationHistory
	err := DB.Where("user_id = ?", userId).
		Order("created_at DESC").
		Limit(limit).
		Preload("Images", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		Find(&histories).Error
	return histories, err
}

func GetPhotoGenerationHistoryByPublicID(userId int, publicID string) (*PhotoGenerationHistory, error) {
	var history PhotoGenerationHistory
	err := DB.Where("user_id = ? AND public_id = ?", userId, publicID).
		Preload("Images", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		First(&history).Error
	if err != nil {
		return nil, err
	}
	return &history, nil
}

func GetPhotoGenerationImageByPublicID(userId int, publicID string) (*PhotoGenerationImage, error) {
	var image PhotoGenerationImage
	err := DB.Where("user_id = ? AND public_id = ?", userId, publicID).First(&image).Error
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func CreatePhotoGenerationHistory(userId int, input PhotoHistoryCreateInput, saveImage func(userId int, image PhotoHistoryImageInput) (storagePath string, mimeType string, err error)) (*PhotoGenerationHistory, []PhotoGenerationHistory, error) {
	status := strings.TrimSpace(input.Status)
	if status == "" {
		if len(input.Images) == 0 {
			status = PhotoHistoryStatusPending
		} else {
			status = PhotoHistoryStatusReady
		}
	}
	if len(input.Images) == 0 && status != PhotoHistoryStatusPending {
		return nil, nil, errors.New("at least one image is required")
	}

	now := time.Now().Unix()
	history := &PhotoGenerationHistory{
		PublicId:         normalizePhotoHistoryPublicID(input.PublicId),
		UserId:           userId,
		Prompt:           strings.TrimSpace(input.Prompt),
		Model:            strings.TrimSpace(input.Model),
		Status:           status,
		GenerationParams: input.GenerationParams,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	var pruned []PhotoGenerationHistory
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		if len(input.Images) > 0 {
			images, err := createPhotoGenerationImages(tx, userId, history.Id, 0, input.Images, saveImage)
			if err != nil {
				return err
			}
			history.Images = images
			if status == PhotoHistoryStatusPending {
				history.Status = PhotoHistoryStatusReady
				if err := tx.Model(history).Update("status", PhotoHistoryStatusReady).Error; err != nil {
					return err
				}
			}
		}

		var trimErr error
		pruned, trimErr = trimPhotoGenerationHistoriesTx(tx, userId, PhotoHistoryPerUserLimit)
		return trimErr
	})
	if err != nil {
		return nil, nil, err
	}

	return history, pruned, nil
}

func AppendPhotoGenerationImages(userId int, historyPublicID string, input PhotoHistoryAppendInput, saveImage func(userId int, image PhotoHistoryImageInput) (storagePath string, mimeType string, err error)) (*PhotoGenerationHistory, error) {
	if len(input.Images) == 0 {
		return nil, errors.New("at least one image is required")
	}

	var history PhotoGenerationHistory
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND public_id = ?", userId, historyPublicID).First(&history).Error; err != nil {
			return err
		}

		var maxSort int
		if err := tx.Model(&PhotoGenerationImage{}).
			Where("history_id = ?", history.Id).
			Select("COALESCE(MAX(sort_order), -1)").
			Scan(&maxSort).Error; err != nil {
			return err
		}

		images, err := createPhotoGenerationImages(tx, userId, history.Id, maxSort+1, input.Images, saveImage)
		if err != nil {
			return err
		}

		updates := map[string]any{
			"updated_at": time.Now().Unix(),
			"status":     PhotoHistoryStatusReady,
		}
		if prompt := strings.TrimSpace(input.Prompt); prompt != "" {
			updates["prompt"] = prompt
			history.Prompt = prompt
		}
		if err := tx.Model(&history).Updates(updates).Error; err != nil {
			return err
		}

		history.Images = append(history.Images, images...)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return GetPhotoGenerationHistoryByPublicID(userId, historyPublicID)
}

func DeletePhotoGenerationHistory(userId int, historyPublicID string) (*PhotoGenerationHistory, error) {
	var history PhotoGenerationHistory
	err := DB.Where("user_id = ? AND public_id = ?", userId, historyPublicID).
		Preload("Images").
		First(&history).Error
	if err != nil {
		return nil, err
	}
	if err := DB.Select("Images").Delete(&history).Error; err != nil {
		return nil, err
	}
	return &history, nil
}

func createPhotoGenerationImages(tx *gorm.DB, userId int, historyId int64, startSort int, inputs []PhotoHistoryImageInput, saveImage func(userId int, image PhotoHistoryImageInput) (storagePath string, mimeType string, err error)) ([]PhotoGenerationImage, error) {
	images := make([]PhotoGenerationImage, 0, len(inputs))
	for index, input := range inputs {
		storagePath, mimeType, err := saveImage(userId, input)
		if err != nil {
			return nil, fmt.Errorf("failed to save image %d: %w", index, err)
		}

		image := PhotoGenerationImage{
			PublicId:      uuid.NewString(),
			HistoryId:     historyId,
			UserId:        userId,
			SortOrder:     startSort + index,
			MimeType:      mimeType,
			StoragePath:   storagePath,
			SourceURL:     strings.TrimSpace(input.URL),
			RevisedPrompt: strings.TrimSpace(input.RevisedPrompt),
		}
		if err := tx.Create(&image).Error; err != nil {
			return nil, err
		}
		images = append(images, image)
	}
	return images, nil
}

func trimPhotoGenerationHistoriesTx(tx *gorm.DB, userId int, limit int) ([]PhotoGenerationHistory, error) {
	var stale []PhotoGenerationHistory
	err := tx.Where("user_id = ?", userId).
		Order("created_at DESC").
		Offset(limit).
		Preload("Images").
		Find(&stale).Error
	if err != nil {
		return nil, err
	}
	if len(stale) == 0 {
		return nil, nil
	}
	for _, history := range stale {
		if err := tx.Select("Images").Delete(&history).Error; err != nil {
			return nil, err
		}
	}
	return stale, nil
}
