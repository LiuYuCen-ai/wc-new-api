package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"

	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
)

// TaskOtherRatioPrecharge is a submit-only OtherRatio that inflates async
// task pre-charge (for example Seedance 1.1× estimated tokens). Token
// settlement must ignore this key so the final charge uses actual usage.
const TaskOtherRatioPrecharge = "precharge"

// TaskOtherRatioBasePrice scales the base billing unit when an admin overrides
// the no-video-input unit price via billing_setting.video_input_price
// (configured price / configured resolution unit price). Unlike precharge it
// participates in token settlement.
const TaskOtherRatioBasePrice = "base_price"

// TaskOtherRatioVideoInput multiplies the base billing when the task request
// carries video input and the model has a configured video-input unit price
// (billing_setting.video_input_price: video / no_video).
const TaskOtherRatioVideoInput = "video_input"

const (
	// TaskResponseFormatKey marks a fetch request as coming from a provider's
	// native API surface, so the response can be rendered in that provider's
	// official envelope instead of the unified task DTO.
	TaskResponseFormatKey = "task_response_format"
	// TaskResponseFormatMiniMaxV2 renders the official MiniMax video V2 body,
	// i.e. {"task": {...}} as documented for MiniMax-H3.
	TaskResponseFormatMiniMaxV2 = "minimax_v2"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}
