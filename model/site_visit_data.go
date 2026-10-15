package model

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SiteVisitEventPageview     = "pageview"
	SiteVisitEventDwell        = "dwell"
	maxSiteVisitDwellSeconds   = 4 * 60 * 60
	maxSiteVisitVisitorIDLen   = 36
)

type SiteVisitBucket struct {
	Id             int   `json:"id"`
	CreatedAt      int64 `json:"created_at" gorm:"bigint;uniqueIndex:idx_svb_bucket,priority:2;not null"`
	IsGuest        bool  `json:"is_guest" gorm:"uniqueIndex:idx_svb_bucket,priority:1;not null"`
	VisitCount     int   `json:"visit_count" gorm:"default:0"`
	DwellSeconds   int   `json:"dwell_seconds" gorm:"default:0"`
	DwellReports   int   `json:"dwell_reports" gorm:"default:0"`
	UniqueVisitors int   `json:"unique_visitors" gorm:"default:0"`
}

func (SiteVisitBucket) TableName() string {
	return "site_visit_buckets"
}

type SiteVisitVisitor struct {
	Id        int    `json:"id"`
	VisitorId string `json:"visitor_id" gorm:"type:varchar(36);uniqueIndex:idx_svv_unique,priority:1;not null"`
	BucketAt  int64  `json:"bucket_at" gorm:"bigint;uniqueIndex:idx_svv_unique,priority:2;not null"`
	IsGuest   bool   `json:"is_guest" gorm:"uniqueIndex:idx_svv_unique,priority:3;not null"`
}

func (SiteVisitVisitor) TableName() string {
	return "site_visit_visitors"
}

type SiteVisitTrackParams struct {
	VisitorId    string
	Event        string
	DwellSeconds int
	IsGuest      bool
}

func normalizeSiteVisitVisitorID(visitorID string) (string, error) {
	visitorID = strings.TrimSpace(visitorID)
	if visitorID == "" || len(visitorID) > maxSiteVisitVisitorIDLen {
		return "", errors.New("invalid visitor_id")
	}
	if _, err := uuid.Parse(visitorID); err != nil {
		return "", errors.New("invalid visitor_id")
	}
	return visitorID, nil
}

func siteVisitHourBucket(now int64) int64 {
	return now - (now % 3600)
}

func TrackSiteVisit(params SiteVisitTrackParams) error {
	visitorID, err := normalizeSiteVisitVisitorID(params.VisitorId)
	if err != nil {
		return err
	}

	event := strings.TrimSpace(params.Event)
	switch event {
	case SiteVisitEventPageview:
		return trackSiteVisitPageview(visitorID, params.IsGuest)
	case SiteVisitEventDwell:
		return trackSiteVisitDwell(visitorID, params.IsGuest, params.DwellSeconds)
	default:
		return errors.New("invalid event")
	}
}

func trackSiteVisitPageview(visitorID string, isGuest bool) error {
	bucketAt := siteVisitHourBucket(time.Now().Unix())
	return DB.Transaction(func(tx *gorm.DB) error {
		bucket, err := findOrCreateSiteVisitBucket(tx, bucketAt, isGuest)
		if err != nil {
			return err
		}

		visitor := &SiteVisitVisitor{
			VisitorId: visitorID,
			BucketAt:  bucketAt,
			IsGuest:   isGuest,
		}
		result := tx.Where(
			"visitor_id = ? AND bucket_at = ? AND is_guest = ?",
			visitorID, bucketAt, isGuest,
		).FirstOrCreate(visitor)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			if err := tx.Model(bucket).Update("unique_visitors", gorm.Expr("unique_visitors + ?", 1)).Error; err != nil {
				return err
			}
		}

		return tx.Model(bucket).Update("visit_count", gorm.Expr("visit_count + ?", 1)).Error
	})
}

func trackSiteVisitDwell(_ string, isGuest bool, dwellSeconds int) error {
	if dwellSeconds <= 0 {
		return nil
	}
	if dwellSeconds > maxSiteVisitDwellSeconds {
		dwellSeconds = maxSiteVisitDwellSeconds
	}

	bucketAt := siteVisitHourBucket(time.Now().Unix())
	return DB.Transaction(func(tx *gorm.DB) error {
		bucket, err := findOrCreateSiteVisitBucket(tx, bucketAt, isGuest)
		if err != nil {
			return err
		}
		return tx.Model(bucket).Updates(map[string]interface{}{
			"dwell_seconds": gorm.Expr("dwell_seconds + ?", dwellSeconds),
			"dwell_reports": gorm.Expr("dwell_reports + ?", 1),
		}).Error
	})
}

func findOrCreateSiteVisitBucket(tx *gorm.DB, bucketAt int64, isGuest bool) (*SiteVisitBucket, error) {
	bucket := &SiteVisitBucket{}
	err := tx.Where("created_at = ? AND is_guest = ?", bucketAt, isGuest).First(bucket).Error
	if err == nil {
		return bucket, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	bucket = &SiteVisitBucket{
		CreatedAt: bucketAt,
		IsGuest:   isGuest,
	}
	if err := tx.Create(bucket).Error; err != nil {
		return nil, err
	}
	return bucket, nil
}

type SiteVisitSummary struct {
	TotalVisits      int     `json:"total_visits"`
	UniqueVisitors   int     `json:"unique_visitors"`
	AvgDwellSeconds  float64 `json:"avg_dwell_seconds"`
	RegisteredUsers  int     `json:"registered_users"`
}

func GetSiteVisitData(startTime int64, endTime int64, guestsOnly bool) ([]*SiteVisitBucket, error) {
	query := DB.Model(&SiteVisitBucket{}).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime)
	if guestsOnly {
		query = query.Where("is_guest = ?", true)
	}

	var buckets []*SiteVisitBucket
	err := query.Order("created_at ASC").Find(&buckets).Error
	return buckets, err
}

func GetSiteVisitSummary(startTime int64, endTime int64, guestsOnly bool) (SiteVisitSummary, error) {
	summary := SiteVisitSummary{}
	buckets, err := GetSiteVisitData(startTime, endTime, guestsOnly)
	if err != nil {
		return summary, err
	}

	var totalDwellSeconds int
	var totalDwellReports int
	for _, bucket := range buckets {
		summary.TotalVisits += bucket.VisitCount
		totalDwellSeconds += bucket.DwellSeconds
		totalDwellReports += bucket.DwellReports
	}
	if totalDwellReports > 0 {
		summary.AvgDwellSeconds = float64(totalDwellSeconds) / float64(totalDwellReports)
	}

	visitorQuery := DB.Model(&SiteVisitVisitor{}).
		Where("bucket_at >= ? AND bucket_at <= ?", startTime, endTime)
	if guestsOnly {
		visitorQuery = visitorQuery.Where("is_guest = ?", true)
	}
	var uniqueVisitors int64
	if err := visitorQuery.Distinct("visitor_id").Count(&uniqueVisitors).Error; err != nil {
		return summary, err
	}
	summary.UniqueVisitors = int(uniqueVisitors)

	registeredUsers, err := CountUsersRegisteredBetween(startTime, endTime)
	if err != nil {
		return summary, err
	}
	summary.RegisteredUsers = int(registeredUsers)
	return summary, nil
}
