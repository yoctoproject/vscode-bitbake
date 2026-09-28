/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import assert from 'assert'
import { assertWillComeTrue } from '../utils/async'

suite('Async integration-test utilities', () => {
  test('assertWillComeTrue fails when the predicate stays false', async () => {
    await assert.rejects(
      async () => {
        await assertWillComeTrue(async () => false, 1, 5)
      },
      assert.AssertionError
    )
  })
})
