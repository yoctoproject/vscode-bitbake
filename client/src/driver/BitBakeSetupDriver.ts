/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import { type IPty } from 'node-pty'
import { expandSettingPath } from '../lib/src/BitbakeSettings'
import { BitbakeTerminal } from '../ui/BitbakeTerminal'
import { type ProcessFrontend } from '../utils/ProcessFrontend'
import { pty } from '../utils/ProcessUtils'

const BITBAKE_SETUP_EXECUTABLE = 'bitbake-setup'

/// Compose host processes for bitbake-setup without a BitBake build environment.
export class BitBakeSetupDriver {
  private bitbakeSetupPath: string | undefined

  constructor (private readonly processFrontend: ProcessFrontend = BitbakeTerminal) {}

  loadSettings (settings: Record<string, unknown>, workspaceFolder: string = '.'): void {
    const variables = {
      workspaceFolder,
      ...Object.fromEntries(Object.entries(process.env).map(([key, value]) => [`env:${key}`, value]))
    }
    this.bitbakeSetupPath = expandSettingPath(settings.bitbakeSetupPath, variables)
  }

  async runBitbakeSetupCommand (args: string[], terminalName: string, isBackground: boolean = false): Promise<IPty> {
    const env = { ...process.env }
    if (this.bitbakeSetupPath !== undefined) {
      env.PATH = [this.bitbakeSetupPath, env.PATH]
        .filter((entry): entry is string => entry !== undefined && entry !== '')
        .join(path.delimiter)
    }

    const shell = process.env.SHELL ?? '/bin/sh'
    const script = `exec ${BITBAKE_SETUP_EXECUTABLE} "$@"`

    return await this.processFrontend.runProcess(
      async () => pty.spawn(shell, ['-c', script, BITBAKE_SETUP_EXECUTABLE, ...args], { env }),
      script,
      {
        name: terminalName,
        background: isBackground
      }
    )
  }
}
