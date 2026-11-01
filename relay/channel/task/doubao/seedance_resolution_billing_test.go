package doubao

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"

	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/utils"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withResolutionTokenBilling 把模型临时切成「分辨率 + 按百万 token」计费，用例结束后还原。
func withResolutionTokenBilling(t *testing.T, modelName string) {
	t.Helper()
	savedMode, err := common.Marshal(billing_setting.GetBillingModeCopy())
	require.NoError(t, err)
	savedUnit, err := common.Marshal(billing_setting.GetResolutionUnitCopy())
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"billing_setting.billing_mode":    string(savedMode),
			"billing_setting.resolution_unit": string(savedUnit),
		}))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":    fmt.Sprintf(`{"%s":"resolution"}`, modelName),
		"billing_setting.resolution_unit": fmt.Sprintf(`{"%s":"million_tokens"}`, modelName),
	}))
	require.True(t, billing_setting.IsResolutionTokenBilling(modelName))
}

// 分辨率「按百万 token」模式下，预扣倍率必须是「估算 token / 1M × 缓冲」，
// 而不是 ratio 模式的 precharge：后者的基数差了一个 QuotaPerUnit/2 量纲，
// 直接相乘会把预扣放大 4 倍多。
func TestSeedanceEstimateBillingResolutionTokenModeUsesMegaTokens(t *testing.T) {
	const modelName = "doubao-seedance-2-0-260128"
	withResolutionTokenBilling(t, modelName)

	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{"resolution": "720p", "ratio": "16:9"},
	}
	ratios := seedanceEstimateBilling(req, modelName, "")
	require.NotEmpty(t, ratios)

	_, hasPrecharge := ratios[constant.TaskOtherRatioPrecharge]
	assert.False(t, hasPrecharge, "分辨率模式下不应再产出 ratio 口径的 precharge")

	tokens := estimateSeedanceTokens(5, 0, "720p", "16:9")
	wantRatio := float64(tokens) / billing_setting.VideoTokensPerMillion * utils.VideoTokenPrechargeBuffer
	assert.InDelta(t, wantRatio, ratios[utils.ResolutionTokensRatioKey], 1e-12)
}

// 含视频输入时，适配器的 token 估算已经把输入时长算进去，分辨率模式也要保留这一份精度。
func TestSeedanceEstimateBillingResolutionTokenModeKeepsVideoInputEstimate(t *testing.T) {
	const modelName = "doubao-seedance-2-0-mini"
	withResolutionTokenBilling(t, modelName)

	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{
			"resolution": "720p",
			"ratio":      "16:9",
			"content": []interface{}{
				map[string]interface{}{"type": "video_url", "video_url": map[string]interface{}{"url": "https://example.com/a.mp4"}},
			},
		},
	}
	ratios := seedanceEstimateBilling(req, modelName, "")
	require.NotEmpty(t, ratios)
	assert.InDelta(t, 14.0/23.0, ratios[constant.TaskOtherRatioVideoInput], 1e-9)

	tokens := estimateSeedanceTokens(5, seedanceMaxVideoInputSeconds(modelName, 1), "720p", "16:9")
	wantRatio := float64(tokens) / billing_setting.VideoTokensPerMillion * utils.VideoTokenPrechargeBuffer
	assert.InDelta(t, wantRatio, ratios[utils.ResolutionTokensRatioKey], 1e-12)
}

// ratio 计费模式保持原有 precharge 口径（基数 modelRatio/2 × QuotaPerUnit）。
func TestSeedanceEstimateBillingRatioModeKeepsPrecharge(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Duration: 5,
		Metadata: map[string]interface{}{"resolution": "720p", "ratio": "16:9"},
	}
	ratios := seedanceEstimateBilling(req, "doubao-seedance-2-0-unknown-ratio-model", "")
	require.NotEmpty(t, ratios)
	tokens := estimateSeedanceTokens(5, 0, "720p", "16:9")
	assert.InDelta(t, seedancePrechargeRatio(tokens), ratios[constant.TaskOtherRatioPrecharge], 1e-12)
	_, hasMegaTokens := ratios[utils.ResolutionTokensRatioKey]
	assert.False(t, hasMegaTokens)
}

// 上游成功返回的 usage 必须被解析出来，否则结算阶段拿不到真实 token。
func TestParseTaskResultParsesUpstreamUsage(t *testing.T) {
	body := []byte(`{
"content": {"video_url": "https://example.com/a.mp4"},
"created_at": 1793350578,
"duration": 5,
"framespersecond": 24,
"id": "01M660CBCAHZPGS4C67512GTS0",
"model": "doubao-seedance-2-0-260128",
"ratio": "16:9",
"resolution": "720p",
"status": "succeeded",
"upstream_task_id": "cgt-20261030165617-oqer7",
"usage": {"completion_tokens": 108900, "total_tokens": 108900}
}`)

	info, err := (&TaskAdaptor{}).ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", info.Status)
	assert.Equal(t, "https://example.com/a.mp4", info.Url)
	assert.Equal(t, 108900, info.TotalTokens)
	assert.Equal(t, 108900, info.CompletionTokens)
	assert.True(t, info.TokensFromUsage)
}

// 提交响应按上游原始格式返回（seedance 官方只回 {"id": "cgt-..."}），
// 仅把 id 换成本地公开任务 ID，不额外包装 OpenAI video 字段。
func TestDoResponseReturnsUpstreamPayloadWithPublicTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	const upstreamID = "cgt-20261030165617-oqer7"
	const publicID = "01M660CBCAHZPGS4C67512GTS0"
	upstream := fmt.Sprintf(`{"id":%q}`, upstreamID)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: publicID}}

	gotUpstreamID, taskData, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, upstreamID, gotUpstreamID)
	assert.JSONEq(t, upstream, string(taskData))

	// 客户端看到的是上游格式，只有 id 被换成公开任务 ID
	assert.JSONEq(t, fmt.Sprintf(`{"id":%q}`, publicID), recorder.Body.String())
}
