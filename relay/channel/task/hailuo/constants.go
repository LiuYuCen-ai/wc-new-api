package hailuo

const (
	ChannelName = "hailuo-video"
)

var ModelList = []string{
	"MiniMax-H3",
	"MiniMax-Hailuo-2.3",
	"MiniMax-Hailuo-2.3-Fast",
	"MiniMax-Hailuo-02",
	"T2V-01-Director",
	"T2V-01",
	"I2V-01-Director",
	"I2V-01-live",
	"I2V-01",
	"S2V-01",
}

const (
	TextToVideoEndpoint   = "/v1/video_generation"
	QueryTaskEndpoint     = "/v1/query/video_generation"
	TextToVideoEndpointV2 = "/v2/video_generation"
	QueryTaskEndpointV2   = "/v2/query/video_generation"
)

const (
	StatusSuccess    = 0
	StatusRateLimit  = 1002
	StatusAuthFailed = 1004
	StatusNoBalance  = 1008
	StatusSensitive  = 1026
	StatusParamError = 2013
	StatusInvalidKey = 2049
)

// V1 task statuses (legacy Hailuo models).
const (
	TaskStatusPreparing  = "Preparing"
	TaskStatusQueueing   = "Queueing"
	TaskStatusProcessing = "Processing"
	TaskStatusSuccess    = "Success"
	TaskStatusFailed     = "Fail"
)

// V2 task statuses (MiniMax-H3).
const (
	TaskStatusV2Queued    = "queued"
	TaskStatusV2Running   = "running"
	TaskStatusV2Succeeded = "succeeded"
	TaskStatusV2Failed    = "failed"
	TaskStatusV2Cancelled = "cancelled"
)

const (
	Resolution512P  = "512P"
	Resolution720P  = "720P"
	Resolution768P  = "768P"
	Resolution1080P = "1080P"
	Resolution2K    = "2K"
)

const (
	DefaultDuration   = 6
	DefaultResolution = Resolution720P

	// H3Defaults match https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create
	DefaultDurationH3   = 5
	DefaultResolutionH3 = Resolution768P
	DefaultRatioH3      = "16:9"
)

const ModelMiniMaxH3 = "MiniMax-H3"
