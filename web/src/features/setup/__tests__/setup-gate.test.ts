import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import {
  clearSetupSessionCache,
  hasConfirmedSetupThisSession,
  isSetupPath,
  rememberSetupCompleted,
  shouldEnterSetup,
} from '../setup-gate'
import type { SetupResponse } from '../types'

function setupResponse(
  overrides: Partial<SetupResponse> & {
    data?: SetupResponse['data']
  } = {}
): SetupResponse {
  return {
    success: true,
    data: {
      status: false,
      root_init: false,
      database_type: '',
      ...overrides.data,
    },
    ...overrides,
  }
}

afterEach(() => {
  clearSetupSessionCache()
})

describe('shouldEnterSetup', () => {
  test('sends users to setup when the status request failed or returned nothing', () => {
    assert.equal(shouldEnterSetup(null), true)
    assert.equal(shouldEnterSetup(undefined), true)
    assert.equal(shouldEnterSetup({ success: false }), true)
    assert.equal(shouldEnterSetup({ success: true }), true)
  })

  test('sends users to setup when the system is not initialized or has no database', () => {
    assert.equal(
      shouldEnterSetup(
        setupResponse({
          data: { status: false, root_init: false, database_type: '' },
        })
      ),
      true
    )
    assert.equal(
      shouldEnterSetup(
        setupResponse({
          data: { status: false, root_init: false, database_type: 'sqlite' },
        })
      ),
      true
    )
  })

  test('allows the rest of the app only after setup is confirmed complete', () => {
    assert.equal(
      shouldEnterSetup(
        setupResponse({
          data: { status: true, root_init: true, database_type: '' },
        })
      ),
      false
    )
  })
})

describe('isSetupPath', () => {
  test('matches the setup wizard routes and ignores other pages', () => {
    assert.equal(isSetupPath('/setup'), true)
    assert.equal(isSetupPath('/setup/'), true)
    assert.equal(isSetupPath('/dashboard'), false)
    assert.equal(isSetupPath('/sign-in'), false)
  })
})

describe('setup session cache', () => {
  test('only skips later checks after setup has been confirmed in this session', () => {
    assert.equal(hasConfirmedSetupThisSession(), false)
    rememberSetupCompleted()
    assert.equal(hasConfirmedSetupThisSession(), true)
    clearSetupSessionCache()
    assert.equal(hasConfirmedSetupThisSession(), false)
  })
})
