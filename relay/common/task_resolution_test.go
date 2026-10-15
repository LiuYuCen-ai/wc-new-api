package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTaskBillingResolution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		req  TaskSubmitReq
		want string
	}{
		{
			name: "top-level resolution wins",
			req:  TaskSubmitReq{Resolution: "1080P", Size: "720p"},
			want: "1080P",
		},
		{
			name: "metadata resolution",
			req: TaskSubmitReq{
				Metadata: map[string]any{"resolution": "4K"},
			},
			want: "4K",
		},
		{
			name: "parameters resolution",
			req: TaskSubmitReq{
				Metadata: map[string]any{
					"parameters": map[string]any{"resolution": "768p"},
				},
			},
			want: "768P",
		},
		{
			name: "size fallback",
			req:  TaskSubmitReq{Size: "1920x1080"},
			want: "1080P",
		},
		{
			name: "default 720P",
			req:  TaskSubmitReq{},
			want: "720P",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, TaskBillingResolution(tt.req))
		})
	}
}

func TestTaskBillingSeconds(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		req      TaskSubmitReq
		fallback int
		want     int
	}{
		{
			name:     "duration field",
			req:      TaskSubmitReq{Duration: 8},
			fallback: 5,
			want:     8,
		},
		{
			name:     "seconds string",
			req:      TaskSubmitReq{Seconds: "6"},
			fallback: 5,
			want:     6,
		},
		{
			name: "metadata duration",
			req: TaskSubmitReq{
				Metadata: map[string]any{"duration": 10.0},
			},
			fallback: 5,
			want:     10,
		},
		{
			name:     "uses official fallback when unset",
			req:      TaskSubmitReq{},
			fallback: 6,
			want:     6,
		},
		{
			name:     "clamps oversized duration",
			req:      TaskSubmitReq{Duration: MaxTaskDurationSeconds + 10},
			fallback: 5,
			want:     MaxTaskDurationSeconds,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, TaskBillingSeconds(tt.req, tt.fallback))
		})
	}
}
