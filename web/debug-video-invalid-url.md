# Debug Session: video-invalid-url

Status: [OPEN]

## Symptom

快速生视频提交后页面提示 `Invalid URL (POST /v1/videos/generations)`，视频请求未成功。

## Hypotheses

1. 输入的是站点根地址，但请求路径在代理层被错误解析或拼接。
2. 浏览器直连外部视频 API 受到 CORS 或代理限制。
3. 用户输入的 URL 含不可见字符、非标准符号或缺少协议。
4. 该调用应由站内后端代理发出，当前前端直连架构不符合部署要求。

## Evidence Plan

- 记录原始 URL、标准化 URL、最终请求 URL（API Key 不记录）。
- 记录请求阶段、HTTP 状态和错误类型。
- 根据运行时日志确认 URL 在浏览器侧是否有效，以及错误由哪一层返回。

## Evidence

- 用户页面提示 `Invalid URL (POST /v1/videos/generations)`。
- 源码中的 URL 字符串拼接可生成完整地址，但生产页面未加载新插桩，说明当前运行的是 Go 二进制内嵌的旧前端构建。
- 项目后端原先没有 `POST /v1/videos/generations` 路由；现有前端直连方案也不符合“后台发送并轮询”的要求。

## Root Cause

问题不是 API URL 输入值无法传递，而是运行中的旧静态资源未更新，并且原实现由浏览器直连外部 API，没有本站后端异步代理。

## Fix

- 新增登录鉴权保护的本站视频提交与查询接口。
- 后端保存内存任务、调用用户指定上游、根据 request_id 自动轮询。
- 前端改为只调用本站接口，不再直连外部 API。
- 增加 URL 校验和 SSRF 防护；API Key 不写日志、数据库或查询 URL。

## Verification

- `bun run build:check`：通过。
- Go 1.25.1 容器中 `go test ./router ./controller`：通过。
- 待重新编译并重启 Go 后端后进行实际请求验证。

## Progress

- [x] 建立调试会话
- [x] 加入最小运行时插桩
- [x] 复现并收集证据
- [x] 确认根因
- [x] 最小修复
- [x] 静态检查与构建验证
- [ ] 运行环境验证
- [ ] 用户确认与清理
