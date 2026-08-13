# Debug Session: video-post-request

Status: [OPEN]

## Symptom

用户怀疑快速生视频的上游 POST 请求没有成功发送；页面曾显示 `upstream did not return request_id`。

## Hypotheses

1. POST 已发送且返回 2xx，但响应中没有顶层 `request_id`。
2. POST 已发送，但完整 URL 指向错误接口。
3. POST 已发送且返回任务 ID，但字段名或嵌套结构与当前解析不一致。
4. POST 在 URL 校验、DNS 或网络连接阶段失败，未到达上游。

## Evidence

待收集。

## Progress

- [x] 建立调试会话
- [ ] 加入最小运行时插桩
- [ ] 复现并收集证据
- [ ] 确认根因
- [ ] 最小修复
- [ ] 修复后验证
- [ ] 用户确认与清理
