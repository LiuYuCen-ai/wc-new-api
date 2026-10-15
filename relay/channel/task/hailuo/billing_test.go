package hailuo

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestEstimateBillingUsesUpstreamDurationInResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "MiniMax-Hailuo-02", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "1080p",
		Duration:   10,
	})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "MiniMax-Hailuo-02",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "MiniMax-Hailuo-02"},
	})
	require.Equal(t, map[string]float64{"seconds": 10}, ratios)
}

func TestEstimateBillingDefaultsToHailuoDurationWhenUnset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "MiniMax-Hailuo-02", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p"})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "MiniMax-Hailuo-02",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "MiniMax-Hailuo-02"},
	})
	require.Equal(t, map[string]float64{"seconds": float64(DefaultDuration)}, ratios)
}

func TestEstimateBillingSkippedWhenNotResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 10})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "MiniMax-Hailuo-02",
	})
	require.Nil(t, ratios)
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
