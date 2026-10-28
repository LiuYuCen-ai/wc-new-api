import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { TFunction } from 'i18next'

import { loginMethodLabel, sessionDevice } from '../login-session-utils'

const translate = ((key: string) => key) as TFunction

describe('login session presentation', () => {
  test('labels built-in and provider OAuth login methods', () => {
    assert.equal(loginMethodLabel('password', translate), 'Password')
    assert.equal(
      loginMethodLabel('2fa', translate),
      'Two-factor Authentication'
    )
    assert.equal(loginMethodLabel('oauth:github', translate), 'OAuth · GitHub')
    assert.equal(
      loginMethodLabel('oauth:custom-provider', translate),
      'OAuth · custom-provider'
    )
  })

  test('labels iPad Safari as iOS when its user agent also mentions Mac OS X', () => {
    const userAgent =
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser'),
      'Safari · iOS'
    )
  })

  test('labels a touch-capable current iPad session as iOS when its desktop user agent says Macintosh', () => {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 5),
      'Safari · iOS'
    )
  })

  test('keeps touch-capable Windows Chrome sessions identifiable', () => {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 10),
      'Chrome · Windows'
    )
  })

  test('keeps Android Chrome sessions identifiable when their user agent mentions Linux', () => {
    const userAgent =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 5),
      'Chrome · Android'
    )
  })

  test('keeps genuine macOS Safari sessions identifiable', () => {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser'),
      'Safari · macOS'
    )
  })

  test('falls back to the unknown-device label for an empty user agent', () => {
    assert.equal(
      sessionDevice('', 'Unknown device', 'Browser'),
      'Unknown device'
    )
  })
})
