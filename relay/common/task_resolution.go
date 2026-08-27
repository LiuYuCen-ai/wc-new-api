package common

import (
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/billing_setting"
)

const defaultTaskBillingSeconds = 5

// TaskBillingResolution returns the resolution used for video billing.
// Lookup order: top-level resolution, metadata.resolution,
// metadata.parameters.resolution, size when it looks like a resolution,
// then 720p.
func TaskBillingResolution(req TaskSubmitReq) string {
	if value := strings.TrimSpace(req.Resolution); value != "" {
		return billing_setting.NormalizeResolution(value)
	}
	if value := metadataString(req.Metadata, "resolution"); value != "" {
		return billing_setting.NormalizeResolution(value)
	}
	if params := metadataObject(req.Metadata, "parameters"); params != nil {
		if value := metadataString(params, "resolution"); value != "" {
			return billing_setting.NormalizeResolution(value)
		}
	}
	if value := strings.TrimSpace(req.Size); value != "" {
		return billing_setting.NormalizeResolution(value)
	}
	return billing_setting.DefaultResolution
}

// TaskBillingSeconds returns the duration multiplier for video billing.
// Values are taken from duration / seconds (including metadata) and capped
// at MaxTaskDurationSeconds. Missing duration uses fallback (the provider's
// official default). A non-positive fallback is replaced with 5 seconds.
func TaskBillingSeconds(req TaskSubmitReq, fallback int) int {
	seconds := req.Duration
	if seconds <= 0 && strings.TrimSpace(req.Seconds) != "" {
		if parsed, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil {
			seconds = parsed
		}
	}
	if seconds <= 0 {
		seconds = metadataInt(req.Metadata, "duration")
	}
	if seconds <= 0 {
		seconds = metadataInt(req.Metadata, "seconds")
	}
	if params := metadataObject(req.Metadata, "parameters"); params != nil {
		if seconds <= 0 {
			seconds = metadataInt(params, "duration")
		}
		if seconds <= 0 {
			seconds = metadataInt(params, "seconds")
		}
	}
	if seconds <= 0 {
		seconds = fallback
	}
	if seconds <= 0 {
		seconds = defaultTaskBillingSeconds
	}
	if seconds > MaxTaskDurationSeconds {
		return MaxTaskDurationSeconds
	}
	return seconds
}

func metadataObject(meta map[string]any, key string) map[string]any {
	if meta == nil {
		return nil
	}
	value, ok := meta[key]
	if !ok || value == nil {
		return nil
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	return object
}

func metadataString(meta map[string]any, key string) string {
	if meta == nil {
		return ""
	}
	value, ok := meta[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}

func metadataInt(meta map[string]any, key string) int {
	if meta == nil {
		return 0
	}
	value, ok := meta[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		if typed > int64(MaxTaskDurationSeconds) {
			return MaxTaskDurationSeconds
		}
		if typed <= 0 {
			return 0
		}
		return int(typed)
	case float64:
		return saturateDuration(typed)
	case float32:
		return saturateDuration(float64(typed))
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return 0
		}
		return parsed
	default:
		return 0
	}
}

func saturateDuration(value float64) int {
	if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
		return 0
	}
	if value > float64(MaxTaskDurationSeconds) {
		return MaxTaskDurationSeconds
	}
	return int(value)
}
