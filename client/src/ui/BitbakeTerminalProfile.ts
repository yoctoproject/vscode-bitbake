/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import path from 'path'
import { logger } from '../lib/src/utils/OutputLogger'

export class BitbakeTerminalProfileProvider implements vscode.TerminalProfileProvider {
  private readonly bitbakeDriver: BitbakeDriver

  constructor (bitbakeDriver: BitbakeDriver) {
    this.bitbakeDriver = bitbakeDriver
  }

  provideTerminalProfile (token?: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {
    // This does not take the lock of bitbakeDriver.bitbakeProcess
    // which means pipe errors if using docker containers in parallel to commands.
    // However it's also expected an interactive terminal can stay open on the side.
    // We can't use BitbakeTerminal either because VSCode won't allow it to be interactive.
    const command = this.bitbakeDriver.composeInteractiveCommand()
    const { shell, script } = this.bitbakeDriver.prepareCommand(command)
    logger.info(`Spawning Bitbake terminal with ${shell} -c ${script}`)
    return {
      options: {
        name: script,
        shellPath: shell,
        shellArgs: ['-c', script],
        env: { ...process.env, ...this.bitbakeDriver.bitbakeSettings.shellEnv },
        cwd: this.bitbakeDriver.bitbakeSettings.workingDirectory,
        iconPath: vscode.Uri.file(path.resolve(__dirname, '../../images/yocto-view-icon.svg'))
      } satisfies vscode.TerminalOptions
    }
  }
}

export async function openBitbakeTerminalProfile (terminalProvider: BitbakeTerminalProfileProvider): Promise<vscode.Terminal> {
  const profile = await terminalProvider.provideTerminalProfile() as vscode.TerminalProfile
  const terminal = vscode.window.createTerminal(profile.options)
  terminal.show()
  return terminal
}
