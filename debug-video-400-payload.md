# Debug Session: video-400-payload

- Status: [OPEN]
- Symptom: Quick Video initially returned HTTP 400; after the duration fix, task creation succeeds but the upstream task ends in HTTP 403.
- Expected: A video task completes and returns a playable URL.
- Scope: `web/default` quick video frontend and channel 2 video upstream.

## Hypotheses

1. Confirmed and fixed: the frontend sent `seconds: "5"`, while the selected upstream model accepts only 6 or 10 seconds.
2. Rejected for the initial failure: the upstream error did not identify `size` as invalid.
3. Rejected for the initial failure: the request reached channel 2 and the upstream validated the video payload.
4. Rejected for the reproduction: the reference-image option was disabled and the upstream identified only `seconds`.
5. Confirmed as a secondary UI issue: the same immediate HTTP failure can be displayed by both the global interceptor and the page catch handler.
6. Confirmed after the fix: channel 2's upstream video worker or proxy lacks access and returns 403 after its own proxy refresh attempts.

## Pre-fix Evidence

- `web/default/src/features/video/api.ts` sends `seconds: params.duration`.
- The old UI and types allowed duration values `5` and `10`.
- `logs/oneapi-20260729013341.log:11362` records channel 2 HTTP 400:
  `Model grok-imagine-1.0-video only supports video_length 6 or 10 seconds`, code `invalid_video_length`, param `seconds`.
- The same request was refunded at line 11364 and completed as `POST /pg/videos` HTTP 400 at line 11365.

## Fix

- Changed the default and short duration option from 5 seconds to 6 seconds.
- Changed `VideoParams.duration` and `VideoHistoryItem.duration` from `5 | 10` to `6 | 10`.
- Kept API field name `seconds` and all channel/model/resolution logic unchanged.
- Formatting, typecheck, and production build passed.

## Post-fix Evidence

- `logs/oneapi-20260729013341.log:11457` records `seconds: 6.00` on channel 2.
- Line 11458 records `POST /pg/videos` HTTP 200, proving task creation and the duration fix succeeded.
- Lines 11461-11509 show normal local polling of task `task_ZvC2BchNu7ihZcILYszFMkPvwZUv2hVa`.
- Line 11512 records the upstream task failure: `Video upstream returned 403 after proxy refresh attempts`.
- This failure reason is returned by the upstream task response and parsed by the local Sora adaptor; that proxy-refresh implementation does not exist in this repository.
- All observed Grok video requests use channel 2 (`https://wcnbai.com`); no alternate configured channel appears in the runtime logs.
- Local async failure handling marks the task failed and calls `RefundTaskQuota` when quota is non-zero.

## Current Conclusion

The local invalid-duration defect is fixed. The remaining blocker is external to this repository: channel 2's upstream video service/proxy is denied with HTTP 403. Resolution requires fixing that provider's video proxy/API entitlement or configuring another working `/v1/videos` upstream and API key.
