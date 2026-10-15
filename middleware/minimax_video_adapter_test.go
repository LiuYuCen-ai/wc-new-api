package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiniMaxVideoRequestConvertRewritesV2Create(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.POST("/v2/video_generation", MiniMaxVideoRequestConvert(), func(c *gin.Context) {
		assert.Equal(t, "/v1/video/generations", c.Request.URL.Path)
		var req map[string]interface{}
		require.NoError(t, common.UnmarshalBodyReusable(c, &req))
		assert.Equal(t, "MiniMax-H3", req["model"])
		assert.Equal(t, "a cat on the beach", req["prompt"])
		assert.Equal(t, "2K", req["resolution"])
		c.Status(http.StatusOK)
	})

	payload := []byte(`{
		"model":"MiniMax-H3",
		"content":[{"type":"text","text":"a cat on the beach"}],
		"resolution":"2K",
		"duration":5,
		"ratio":"16:9"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/v2/video_generation", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestMiniMaxVideoRequestConvertRewritesV2Query(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/v2/query/video_generation/:task_id", MiniMaxVideoRequestConvert(), func(c *gin.Context) {
		assert.Equal(t, "/v1/video/generations/424010985738629", c.Request.URL.Path)
		assert.Equal(t, "424010985738629", c.GetString("task_id"))
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/v2/query/video_generation/424010985738629", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}
