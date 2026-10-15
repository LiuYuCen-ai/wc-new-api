package model

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDeleteUserTaskRemovesOnlyOwnTask(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID: "task_own",
		UserId: 1,
		Status: TaskStatusSuccess,
	})
	insertTask(t, &Task{
		TaskID: "task_other",
		UserId: 2,
		Status: TaskStatusSuccess,
	})

	require.NoError(t, DeleteUserTask(1, "task_own"))

	_, exists, err := GetByTaskId(1, "task_own")
	require.NoError(t, err)
	assert.False(t, exists)

	_, exists, err = GetByTaskId(2, "task_other")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestDeleteUserTaskDoesNotDeleteAnotherUsersTask(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID: "task_shared_id",
		UserId: 2,
		Status: TaskStatusSuccess,
	})

	err := DeleteUserTask(1, "task_shared_id")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	_, exists, getErr := GetByTaskId(2, "task_shared_id")
	require.NoError(t, getErr)
	assert.True(t, exists)
}

func TestDeleteUserTaskMissingId(t *testing.T) {
	truncateTables(t)

	err := DeleteUserTask(1, "missing")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	err = DeleteUserTask(1, "  ")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestDeleteUserTaskByNumericId(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_public",
		UserId: 1,
		Status: TaskStatusSuccess,
	}
	insertTask(t, task)
	require.NotZero(t, task.ID)

	require.NoError(t, DeleteUserTask(1, strconv.FormatInt(task.ID, 10)))

	_, exists, err := GetByTaskId(1, "task_public")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestDeleteUserTaskByNestedPayloadID(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID: "task_public_keep",
		UserId: 1,
		Status: TaskStatusSuccess,
		Data:   json.RawMessage(`{"task":{"id":"task_nested_keep"}}`),
	})
	insertTask(t, &Task{
		TaskID: "task_public_gone",
		UserId: 1,
		Status: TaskStatusSuccess,
		Data:   json.RawMessage(`{"task":{"id":"task_nested_gone","content":{"url":"https://cdn.example.com/a.mp4"}}}`),
	})
	insertTask(t, &Task{
		TaskID: "task_other_nested",
		UserId: 2,
		Status: TaskStatusSuccess,
		Data:   json.RawMessage(`{"task":{"id":"task_nested_gone"}}`),
	})

	require.NoError(t, DeleteUserTask(1, "task_nested_gone"))

	_, exists, err := GetByTaskId(1, "task_public_gone")
	require.NoError(t, err)
	assert.False(t, exists)

	_, exists, err = GetByTaskId(1, "task_public_keep")
	require.NoError(t, err)
	assert.True(t, exists)

	_, exists, err = GetByTaskId(2, "task_other_nested")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestDeleteUserTaskByUpstreamTaskID(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID: "task_public_upstream",
		UserId: 1,
		Status: TaskStatusSuccess,
		PrivateData: TaskPrivateData{
			UpstreamTaskID: "437510019109251",
		},
	})

	require.NoError(t, DeleteUserTask(1, "437510019109251"))

	_, exists, err := GetByTaskId(1, "task_public_upstream")
	require.NoError(t, err)
	assert.False(t, exists)
}
