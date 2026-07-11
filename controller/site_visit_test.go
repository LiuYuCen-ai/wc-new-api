package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type siteVisitDataResponse struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    []model.SiteVisitBucket `json:"data"`
	Summary model.SiteVisitSummary  `json:"summary"`
}

func setupSiteVisitControllerTestDB(t *testing.T) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SiteVisitBucket{}, &model.SiteVisitVisitor{}))
}

func decodeSiteVisitDataResponse(t *testing.T, recorder *httptest.ResponseRecorder) siteVisitDataResponse {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload siteVisitDataResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload
}

func TestTrackSiteVisitRecordsGuestPageviewAndDwell(t *testing.T) {
	setupSiteVisitControllerTestDB(t)
	visitorID := uuid.NewString()

	pageviewBody, err := common.Marshal(map[string]interface{}{
		"visitor_id": visitorID,
		"event":      model.SiteVisitEventPageview,
		"is_guest":   true,
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/visit/track", bytes.NewReader(pageviewBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	TrackSiteVisit(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	dwellBody, err := common.Marshal(map[string]interface{}{
		"visitor_id":     visitorID,
		"event":          model.SiteVisitEventDwell,
		"is_guest":       true,
		"dwell_seconds":  90,
	})
	require.NoError(t, err)

	recorder = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/visit/track", bytes.NewReader(dwellBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	TrackSiteVisit(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var buckets []model.SiteVisitBucket
	require.NoError(t, model.DB.Where("is_guest = ?", true).Find(&buckets).Error)
	require.Len(t, buckets, 1)
	assert.Equal(t, 1, buckets[0].VisitCount)
	assert.Equal(t, 1, buckets[0].UniqueVisitors)
	assert.Equal(t, 90, buckets[0].DwellSeconds)
	assert.Equal(t, 1, buckets[0].DwellReports)
}

func TestGetSiteVisitDatesReturnsGuestBuckets(t *testing.T) {
	setupSiteVisitControllerTestDB(t)
	bucketAt := int64(3600)
	require.NoError(t, model.DB.Create(&model.SiteVisitBucket{
		CreatedAt:      bucketAt,
		IsGuest:        true,
		VisitCount:     3,
		DwellSeconds:   120,
		DwellReports:   2,
		UniqueVisitors: 2,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Username:  "period-user",
		Password:  "password123",
		CreatedAt: 1800,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("role", common.RoleAdminUser)
	ctx.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/data/visits?start_timestamp=1&end_timestamp=7200",
		nil,
	)

	GetSiteVisitDates(ctx)

	payload := decodeSiteVisitDataResponse(t, recorder)
	require.Len(t, payload.Data, 1)
	assert.Equal(t, 3, payload.Data[0].VisitCount)
	assert.Equal(t, 2, payload.Data[0].UniqueVisitors)
	assert.Equal(t, 120, payload.Data[0].DwellSeconds)
	assert.Equal(t, 3, payload.Summary.TotalVisits)
	assert.Equal(t, 0, payload.Summary.UniqueVisitors)
	assert.Equal(t, 1, payload.Summary.RegisteredUsers)
}
