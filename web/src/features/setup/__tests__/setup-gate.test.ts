/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
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
