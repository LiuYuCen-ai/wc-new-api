package hailuo

import "strings"

type SubjectReference struct {
	Type  string   `json:"type"`  // Subject type, currently only supports "character"
	Image []string `json:"image"` // Array of subject reference images (currently only supports single image)
}

// VideoRequest is the V1 create payload for legacy Hailuo models.
type VideoRequest struct {
	Model            string             `json:"model"`
	Prompt           string             `json:"prompt,omitempty"`
	PromptOptimizer  *bool              `json:"prompt_optimizer,omitempty"`
	FastPretreatment *bool              `json:"fast_pretreatment,omitempty"`
	Duration         *int               `json:"duration,omitempty"`
	Resolution       string             `json:"resolution,omitempty"`
	CallbackURL      string             `json:"callback_url,omitempty"`
	AigcWatermark    *bool              `json:"aigc_watermark,omitempty"`
	FirstFrameImage  string             `json:"first_frame_image,omitempty"` // For image-to-video and start-end-to-video
	LastFrameImage   string             `json:"last_frame_image,omitempty"`  // For start-end-to-video
	SubjectReference []SubjectReference `json:"subject_reference,omitempty"` // For subject-reference-to-video
}

type VideoResponse struct {
	TaskID   string   `json:"task_id"`
	BaseResp BaseResp `json:"base_resp"`
}

type BaseResp struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

type QueryTaskRequest struct {
	TaskID string `json:"task_id"`
}

type QueryTaskResponse struct {
	TaskID      string   `json:"task_id"`
	Status      string   `json:"status"`
	FileID      string   `json:"file_id,omitempty"`
	VideoWidth  int      `json:"video_width,omitempty"`
	VideoHeight int      `json:"video_height,omitempty"`
	BaseResp    BaseResp `json:"base_resp"`
}

type ModelConfig struct {
	Name                 string
	APIVersion           string // "v1" or "v2"
	DefaultResolution    string
	DefaultRatio         string
	SupportedDurations   []int
	SupportedResolutions []string
	HasPromptOptimizer   bool
	HasFastPretreatment  bool
}

type RetrieveFileResponse struct {
	File     FileObject `json:"file"`
	BaseResp BaseResp   `json:"base_resp"`
}

type FileObject struct {
	FileID      int64  `json:"file_id"`
	Bytes       int64  `json:"bytes"`
	CreatedAt   int64  `json:"created_at"`
	Filename    string `json:"filename"`
	Purpose     string `json:"purpose"`
	DownloadURL string `json:"download_url"`
}

// ---- V2 (MiniMax-H3) ----

type MediaURL struct {
	URL string `json:"url"`
}

type ContentItem struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

// VideoGenerationV2Request matches POST /v2/video_generation.
type VideoGenerationV2Request struct {
	Model         string        `json:"model"`
	Content       []ContentItem `json:"content"`
	Resolution    string        `json:"resolution"`
	Duration      int           `json:"duration"`
	Ratio         string        `json:"ratio,omitempty"`
	CallbackURL   string        `json:"callback_url,omitempty"`
	AigcWatermark *bool         `json:"aigc_watermark,omitempty"`
}

type VideoGenerationV2Response struct {
	TaskID string `json:"task_id"`
}

type OAIErrorBody struct {
	Type      string         `json:"type"`
	Error     *OAIErrorDetail `json:"error,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
}

type OAIErrorDetail struct {
	Type     string `json:"type"`
	Message  string `json:"message"`
	HTTPCode string `json:"http_code,omitempty"`
}

type QueryTaskV2Response struct {
	Task *VideoTaskV2 `json:"task"`
}

type VideoTaskV2 struct {
	ID         string              `json:"id"`
	Model      string              `json:"model"`
	Status     string              `json:"status"`
	Error      *VideoTaskV2Error   `json:"error,omitempty"`
	CreatedAt  int64               `json:"created_at"`
	UpdatedAt  int64               `json:"updated_at"`
	Content    *VideoTaskV2Content `json:"content,omitempty"`
	Resolution string              `json:"resolution,omitempty"`
	Duration   int                 `json:"duration,omitempty"`
	Usage      *VideoTaskV2Usage   `json:"usage,omitempty"`
	Ratio      string              `json:"ratio,omitempty"`
	TaskType   string              `json:"task_type,omitempty"`
	Modality   string              `json:"modality,omitempty"`
}

type VideoTaskV2Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type VideoTaskV2Content struct {
	URL    string `json:"url,omitempty"`
	Prompt string `json:"prompt,omitempty"`
}

type VideoTaskV2Usage struct {
	TotalSeconds       int `json:"total_seconds,omitempty"`
	InputSeconds       int `json:"input_seconds,omitempty"`
	OutputSeconds      int `json:"output_seconds,omitempty"`
	InputImageCount    int `json:"input_image_count,omitempty"`
	InputAudioSeconds  int `json:"input_audio_seconds,omitempty"`
	TotalTokens        int `json:"total_tokens,omitempty"`
	PromptTokens       int `json:"prompt_tokens,omitempty"`
	CompletionTokens   int `json:"completion_tokens,omitempty"`
}

func IsVideoGenerationV2(model string) bool {
	return strings.EqualFold(strings.TrimSpace(model), ModelMiniMaxH3)
}

func GetModelConfig(model string) ModelConfig {
	configs := map[string]ModelConfig{
		ModelMiniMaxH3: {
			Name:                 ModelMiniMaxH3,
			APIVersion:           "v2",
			DefaultResolution:    DefaultResolutionH3,
			DefaultRatio:         DefaultRatioH3,
			SupportedDurations:   []int{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
			SupportedResolutions: []string{Resolution768P, Resolution2K},
			HasPromptOptimizer:   false,
			HasFastPretreatment:  false,
		},
		"MiniMax-Hailuo-2.3": {
			Name:                 "MiniMax-Hailuo-2.3",
			APIVersion:           "v1",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-2.3-Fast": {
			Name:                 "MiniMax-Hailuo-2.3-Fast",
			APIVersion:           "v1",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"MiniMax-Hailuo-02": {
			Name:                 "MiniMax-Hailuo-02",
			APIVersion:           "v1",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6, 10},
			SupportedResolutions: []string{Resolution512P, Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  true,
		},
		"T2V-01-Director": {
			Name:                 "T2V-01-Director",
			APIVersion:           "v1",
			DefaultResolution:    Resolution768P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution768P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"T2V-01": {
			Name:                 "T2V-01",
			APIVersion:           "v1",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-Director": {
			Name:                 "I2V-01-Director",
			APIVersion:           "v1",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01-live": {
			Name:                 "I2V-01-live",
			APIVersion:           "v1",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"I2V-01": {
			Name:                 "I2V-01",
			APIVersion:           "v1",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P, Resolution1080P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
		"S2V-01": {
			Name:                 "S2V-01",
			APIVersion:           "v1",
			DefaultResolution:    Resolution720P,
			SupportedDurations:   []int{6},
			SupportedResolutions: []string{Resolution720P},
			HasPromptOptimizer:   true,
			HasFastPretreatment:  false,
		},
	}

	if config, exists := configs[model]; exists {
		return config
	}
	if IsVideoGenerationV2(model) {
		cfg := configs[ModelMiniMaxH3]
		cfg.Name = model
		return cfg
	}

	return ModelConfig{
		Name:                 model,
		APIVersion:           "v1",
		DefaultResolution:    DefaultResolution,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{DefaultResolution},
		HasPromptOptimizer:   true,
		HasFastPretreatment:  false,
	}
}

func officialDuration(model string) int {
	cfg := GetModelConfig(model)
	if cfg.APIVersion == "v2" {
		return DefaultDurationH3
	}
	if len(cfg.SupportedDurations) > 0 && cfg.SupportedDurations[0] > 0 {
		return cfg.SupportedDurations[0]
	}
	return DefaultDuration
}
