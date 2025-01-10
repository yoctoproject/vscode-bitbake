/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

export async function run (): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })
  const testsRoot = path.resolve(__dirname, '../..')

  const files: string[] = await glob('**/integration-tests/**/**.test.js', { cwd: testsRoot })

  // Add files to the test suite
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

  // Run the mocha test
  mocha.run(failures => {
    if (failures > 0) {
      throw new Error('Tests failed: ' + failures)
    } else {
      // Say that the tests passed
      console.log('All tests passed.')
    }
  })
}
