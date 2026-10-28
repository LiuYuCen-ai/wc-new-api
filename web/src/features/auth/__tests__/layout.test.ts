import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { AUTH_LAYOUT_SURFACE_CLASSES } from '../auth-layout-classes'

describe('auth layout surface', () => {
  test('keeps the login page on a white surface with light-theme tokens', () => {
    const classes = AUTH_LAYOUT_SURFACE_CLASSES.split(' ')

    assert.ok(classes.includes('bg-white'))
    assert.ok(classes.includes('theme-light'))
    assert.ok(classes.includes('text-foreground'))
  })
})
