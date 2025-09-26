/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import type childProcess from 'child_process'
import { logger } from '../lib/src/utils/OutputLogger'
import type * as nodepty from 'node-pty'

function importFromVSCode (id: string): NodeRequire {
  /* Inspired by https://github.com/microsoft/vscode/issues/658#issuecomment-982842847
   * VSCode uses electron with a custom NODE_MODULE_VERSION and it's own node-pty version
   * We need to use the same node-pty version as VSCode to avoid compatibility issues
   * Meanwhile, under jest, we need to use the regular node-pty version
   * Types still need to be imported normally at compile time
  */
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${vscode.env.appRoot}/node_modules.asar/${id}`)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    // ignore
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${vscode.env.appRoot}/node_modules/${id}`)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    // ignore
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(id)
}

// The conversion allows the linter to understand the type of the imported module
export const pty = importFromVSCode('node-pty') as unknown as typeof nodepty

export const BITBAKE_TIMEOUT = 300000
export const BITBAKE_EXIT_TIMEOUT = 30000

export type KillProcessFunction = (child: nodepty.IPty) => Promise<void>

/// Wait for an asynchronous process to finish and return its output
export async function finishProcessExecution (process: Promise<nodepty.IPty>, timeoutCallback: KillProcessFunction = async (child) => { child.kill() }, timeout = BITBAKE_TIMEOUT): Promise<childProcess.SpawnSyncReturns<Buffer>> {
  return await new Promise<childProcess.SpawnSyncReturns<Buffer>>((resolve, reject) => {
    process.then((child) => {
      let stdout = ''
      const stderr = ''
      child.onData((data) => {
        stdout += data
      })
      child.onExit((event) => {
        clearTimeout(timer)
        const stdoutBuffer = Buffer.from(stdout)
        const stderrBuffer = Buffer.from(stderr)
        resolve({
          pid: child.pid ?? -1,
          output: [stdoutBuffer, stderrBuffer],
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          status: event.exitCode,
          signal: null
        })
      })
      const timer = setTimeout(() => {
        void timeoutCallback(child)
        logger.error(`Process ${child.pid} timed out after ${timeout}ms`)
        // TODO If we can't terminate, just resolve with the current output
      }, timeout)
    },
    (error) => {
      reject(error)
    })
  })
}
