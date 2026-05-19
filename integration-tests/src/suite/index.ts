/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

export function run (testsRoot: string, cb: (error: unknown, failures?: number) => void): void {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })

  const testGlob = process.env.INTEGRATION_TEST_GLOB ?? '**/**.test.js'

  glob(testGlob, { cwd: path.join(testsRoot, '../tests') }).then(files => {
    console.log(`Using test glob: ${testGlob}`)
    console.log(`Found test files: ${files}`)

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, '../tests', f)))

    // Run the mocha test
    mocha.run(failures => {
      if (failures > 0) {
        cb('Tests failed', failures)
      } else {
        console.log('All tests passed.')
        cb(null, 0)
      }
    })
  }).catch(error => cb(error))
}
