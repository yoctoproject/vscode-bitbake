/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type childProcess from 'child_process'

/// Wait for an asynchronous process to finish and return its output
export async function finishProcessExecution (process: Promise<childProcess.ChildProcess>): Promise<childProcess.SpawnSyncReturns<Buffer>> {
  return await new Promise<childProcess.SpawnSyncReturns<Buffer>>((resolve, reject) => {
    process.then((child) => {
      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (data) => {
        stdout += data
      })
      child.stderr?.on('data', (data) => {
        stderr += data
      })
      child.on('close', (code) => {
        const stdoutBuffer = Buffer.from(stdout)
        const stderrBuffer = Buffer.from(stderr)
        resolve({
          pid: -1,
          output: [stdoutBuffer, stderrBuffer],
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          status: code,
          signal: null
        })
      })
    },
    (error) => {
      reject(error)
    })
  })
}
