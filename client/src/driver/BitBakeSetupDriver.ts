/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { type IPty } from 'node-pty'
import { BitbakeTerminal } from '../ui/BitbakeTerminal'
import { type ProcessFrontend } from '../utils/ProcessFrontend'
import { pty } from '../utils/ProcessUtils'

const BITBAKE_SETUP_EXECUTABLE = 'bitbake-setup'

/// Compose host processes for bitbake-setup without a BitBake build environment.
export class BitBakeSetupDriver {
  private bitbakeSetupPath: string | undefined

  constructor (private readonly processFrontend: ProcessFrontend = BitbakeTerminal) {}

  loadSettings (settings: Record<string, unknown>): void {
    this.bitbakeSetupPath = typeof settings.bitbakeSetupPath === 'string' ? settings.bitbakeSetupPath : undefined
  }

  resolveBitbakeSetupExecutablePath (): string | undefined {
    for (const directory of this.getSearchPath()) {
      const executablePath = path.join(directory, BITBAKE_SETUP_EXECUTABLE)
      try {
        const stats = fs.statSync(executablePath)
        if (stats.isFile()) {
          fs.accessSync(executablePath, fs.constants.X_OK)
          return executablePath
        }
      } catch {
        // Continue searching the combined PATH.
      }
    }
    return undefined
  }

  async runBitbakeSetupCommand (args: string[], terminalName: string, isBackground: boolean = false): Promise<IPty> {
    const env = this.getEnvironment()
    const command = [BITBAKE_SETUP_EXECUTABLE, ...args].map(arg => JSON.stringify(arg)).join(' ')

    return await this.processFrontend.runProcess(
      async dimensions => pty.spawn(
        BITBAKE_SETUP_EXECUTABLE,
        args,
        {
          env,
          cols: dimensions?.columns,
          rows: dimensions?.rows
        }
      ),
      command,
      {
        name: terminalName,
        background: isBackground
      }
    )
  }

  private getSearchPath (): string[] {
    return this.getEnvironment().PATH?.split(path.delimiter).filter(entry => entry !== '') ?? []
  }

  private getEnvironment (): NodeJS.ProcessEnv {
    const env = { ...process.env }
    if (this.bitbakeSetupPath !== undefined && this.bitbakeSetupPath !== '') {
      env.PATH = [env.PATH, this.bitbakeSetupPath]
        .filter((entry): entry is string => entry !== undefined && entry !== '')
        .join(path.delimiter)
    }
    return env
  }
}
