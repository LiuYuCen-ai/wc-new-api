package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type siteVisitTrackRequest struct {
	VisitorId    string `json:"visitor_id"`
	Event        string `json:"event"`
	DwellSeconds int    `json:"dwell_seconds"`
	IsGuest      bool   `json:"is_guest"`
}

func TrackSiteVisit(c *gin.Context) {
	var req siteVisitTrackRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}

	if err := model.TrackSiteVisit(model.SiteVisitTrackParams{
		VisitorId:    req.VisitorId,
		Event:        req.Event,
		DwellSeconds: req.DwellSeconds,
		IsGuest:      req.IsGuest,
	}); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func GetSiteVisitDates(c *gin.Context) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid end_timestamp")
		return
	}
	if endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return
	}

	guestsOnly := c.DefaultQuery("guests_only", "true") != "false"
	dates, err := model.GetSiteVisitData(startTimestamp, endTimestamp, guestsOnly)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summary, err := model.GetSiteVisitSummary(startTimestamp, endTimestamp, guestsOnly)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
		"summary": summary,
	})
}
