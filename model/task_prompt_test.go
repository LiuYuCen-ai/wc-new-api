package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTaskPromptFromRequest(t *testing.T) {
	assert.Equal(t, "a rainy street", TaskPromptFromRequest(map[string]any{
		"prompt": "  a rainy street  ",
		"model":  "MiniMax-H3",
	}))
	assert.Equal(t, "from content", TaskPromptFromRequest(map[string]any{
		"content": []any{
			map[string]any{"type": "text", "text": "from content"},
		},
	}))
	assert.Equal(t, "", TaskPromptFromRequest(nil))
	assert.Equal(t, "", TaskPromptFromRequest(map[string]any{"prompt": "   "}))

	long := strings.Repeat("a", maxTaskPromptRunes+20)
	got := TaskPromptFromRequest(map[string]any{"prompt": long})
	assert.Equal(t, maxTaskPromptRunes, len([]rune(got)))
}
