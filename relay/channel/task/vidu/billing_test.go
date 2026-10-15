package vidu

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
	loadBillingMode(t, "viduq1", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Resolution: "720p",
		Seconds:    "12",
	})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "viduq1",
	})
	require.Equal(t, map[string]float64{"seconds": 12}, ratios)
}

func TestEstimateBillingDefaultsToOfficialSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loadBillingMode(t, "vidu2.0", "resolution")

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Resolution: "720p"})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "vidu2.0",
	})
	require.Equal(t, map[string]float64{"seconds": 4}, ratios)
}

func TestEstimateBillingSkippedWhenNotResolutionMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Duration: 12})

	ratios := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
		OriginModelName: "viduq1",
	})
	require.Nil(t, ratios)
}

func TestConvertToRequestPayloadPrefersResolutionOverSize(t *testing.T) {
	body, err := (&TaskAdaptor{}).convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Prompt:     "a cat",
		Resolution: "720P",
		Size:       "1080p",
		Duration:   8,
	}, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "viduq1"}})

	require.NoError(t, err)
	require.Equal(t, "720p", body.Resolution)
	require.Equal(t, 8, body.Duration)
}

func TestConvertToRequestPayloadUsesOfficialDuration(t *testing.T) {
	q1, err := (&TaskAdaptor{}).convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Prompt: "a cat",
	}, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "viduq1"}})
	require.NoError(t, err)
	require.Equal(t, 5, q1.Duration)

	v20, err := (&TaskAdaptor{}).convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Prompt: "a cat",
	}, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "vidu2.0"}})
	require.NoError(t, err)
	require.Equal(t, 4, v20.Duration)
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
