/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'
import glob from 'glob'
import Mocha from 'mocha'

export async function run (): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })
  const testsRoot = path.resolve(__dirname, '../..')
  console.log(testsRoot)

  await new Promise((_resolve, _reject) => {
    glob('**/integration-tests/**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err !== undefined && err !== null) {
        _reject(err); return
      }

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            _reject(new Error(`${failures} tests failed.`))
          } else {
            _resolve('All tests passed.')
          }
        })
      } catch (err) {
        _reject(err)
      }
    })
  })
}
