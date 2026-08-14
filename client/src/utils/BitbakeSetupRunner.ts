/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { spawn } from 'child_process'

export type BitbakeSetupRunResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

export async function runBitbakeSetup (executablePath: string, argv: string[], cwd?: string): Promise<BitbakeSetupRunResult> {
  return await new Promise<BitbakeSetupRunResult>((resolve, reject) => {
    const child = spawn(executablePath, argv, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString()
    })

    child.once('error', (error) => {
      reject(error)
    })

    child.once('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr
      })
    })
  })
}
