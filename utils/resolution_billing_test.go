package utils

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestEstimateResolutionSecondsUsesRequestDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "video-model", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "1080p",
		Duration:   8,
	})

	require.Equal(t, map[string]float64{"seconds": 8}, EstimateResolutionSeconds(ctx, "video-model", 5))
}

func TestEstimateResolutionSecondsFallsBackToOfficialSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "video-model", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p"})

	require.Equal(t, map[string]float64{"seconds": 6}, EstimateResolutionSeconds(ctx, "video-model", 6))
}

func TestEstimateResolutionSecondsSkippedWhenNotResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 8})

	require.Nil(t, EstimateResolutionSeconds(ctx, "video-model", 5))
}

func TestResolutionSecondsReadsSecondsField(t *testing.T) {
	require.Equal(t, 10, ResolutionSeconds(relaycommon.TaskSubmitReq{Seconds: "10"}, 5))
	require.Equal(t, 5, ResolutionSeconds(relaycommon.TaskSubmitReq{}, 5))
}

func loadBillingMode(t *testing.T, model, mode string) {
	t.Helper()
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"` + model + `":"` + mode + `"}`,
	}))
}
