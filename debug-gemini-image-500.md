# Debug Session: gemini-image-500

Status: [OPEN]

## Symptom

Using Gemini image generation in the photo playground returns HTTP 500 with:

- `Request failed with status code 500`
- `upstream error: do request failed`

GPT image generation works normally.

## Hypotheses

1. Gemini playground requests are routed through `/pg/chat/completions`, while GPT uses `/pg/images/generations`; the Gemini path may hit a different relay/adaptor and fail before upstream response parsing.
2. The configured Gemini channel is OpenAI-compatible chat completions, so Gemini-native fields such as `generationConfig`, `responseModalities`, or `extra_body.google.image_config` may be rejected by the upstream proxy.
3. The selected Gemini model id may not match the actual upstream model or enabled model mapping, causing route/channel selection or upstream model lookup failure.
4. The frontend request body for Gemini may not include the exact fields required by the upstream proxy to trigger image generation, so the upstream rejects the request or returns an unsupported response.
5. Backend logs likely contain the concrete upstream request failure reason, but the UI toast only shows the generic relay wrapper error.

## Evidence Plan

- Inspect frontend Gemini request construction.
- Inspect backend playground route and relay mode for `/pg/chat/completions`.
- Inspect OpenAI-compatible channel request struct behavior for unknown Gemini fields.
- Ask user for backend log line if static code cannot reveal exact upstream rejection.
