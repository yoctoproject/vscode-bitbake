/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type childProcess from 'child_process'
import { logger } from './OutputLogger'

export const BITBAKE_TIMEOUT = 300000
export const BITBAKE_EXIT_TIMEOUT = 30000

/// Wait for an asynchronous process to finish and return its output
export async function finishProcessExecution (process: Promise<childProcess.ChildProcess>, timeout = BITBAKE_TIMEOUT): Promise<childProcess.SpawnSyncReturns<Buffer>> {
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
        clearTimeout(timer)
        const stdoutBuffer = Buffer.from(stdout)
        const stderrBuffer = Buffer.from(stderr)
        resolve({
          pid: child.pid ?? -1,
          output: [stdoutBuffer, stderrBuffer],
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          status: code,
          signal: null
        })
      })
      const timer = setTimeout(() => {
        void killBitbake(child)
        logger.error(`Process ${child.pid} timed out after ${timeout}ms`)
        // TODO If we can't terminate, just resolve with the current output
      }, timeout)
    },
    (error) => {
      reject(error)
    })
  })
}

/// Kill bitbake and agressively terminate it after a timeout
export async function killBitbake (child: childProcess.ChildProcess, timeout: number = BITBAKE_EXIT_TIMEOUT): Promise<void> {
  // The first SIGINT will wait for current build tasks to complete
  child.kill('SIGINT')

  // The second SIGINT will interrupt build tasks after a timeout
  setTimeout(() => {
    child.kill('SIGINT')
  }, timeout)

  // The third SIGINT will exit no matter what, but may require cleanup of bitbake.lock
  setTimeout(() => {
    child.kill('SIGINT')
  }, timeout * 2)
}
