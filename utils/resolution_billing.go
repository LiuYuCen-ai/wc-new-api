package utils

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

// EstimateResolutionSeconds returns OtherRatios for billing_mode=resolution.
// The unit price is selected by resolution in ModelPriceHelperPerCall;
// this helper only multiplies by seconds. officialSeconds is the provider's
// documented default duration when the request omits duration/seconds.
func EstimateResolutionSeconds(c *gin.Context, modelName string, officialSeconds int) map[string]float64 {
	if billing_setting.GetBillingMode(modelName) != billing_setting.BillingModeResolution {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		req = relaycommon.TaskSubmitReq{}
	}
	return map[string]float64{
		"seconds": float64(ResolutionSeconds(req, officialSeconds)),
	}
}

// ResolutionSeconds reads duration from the task request and falls back to
// the provider's official default. The value is capped at MaxTaskDurationSeconds.
func ResolutionSeconds(req relaycommon.TaskSubmitReq, officialSeconds int) int {
	return relaycommon.TaskBillingSeconds(req, officialSeconds)
}
