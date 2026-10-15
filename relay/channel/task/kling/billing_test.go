package kling

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestEstimateBillingUsesRequestSecondsInResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "kling-v1", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "1080p",
		Duration:   8,
	})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "kling-v1",
	})
	require.Equal(t, map[string]float64{"seconds": 8}, ratios)
}

func TestEstimateBillingDefaultsToOfficialFiveSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "kling-v1", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "1080p"})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "kling-v1",
	})
	require.Equal(t, map[string]float64{"seconds": 5}, ratios)
}

func TestEstimateBillingSkippedWhenNotResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 8})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "kling-v1",
	})
	require.Nil(t, ratios)
}

func TestConvertToRequestPayloadCopiesResolutionAndSeconds(t *testing.T) {
	body, err := (&TaskAdaptor{}).convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Prompt:     "a cat",
		Resolution: "1080P",
		Seconds:    "10",
	}, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "kling-v1"}})

	require.NoError(t, err)
	require.Equal(t, "1080p", body.Resolution)
	require.Equal(t, "10", body.Duration)
}

func TestConvertToRequestPayloadDefaultsToOfficialFiveSeconds(t *testing.T) {
	body, err := (&TaskAdaptor{}).convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Prompt:     "a cat",
		Resolution: "720p",
	}, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "kling-v1"}})

	require.NoError(t, err)
	require.Equal(t, "5", body.Duration)
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
