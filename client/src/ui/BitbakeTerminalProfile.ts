/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as vscode from 'vscode'
import { BitbakePseudoTerminal } from './BitbakeTerminal'
import { type BitbakeDriver } from '../driver/BitbakeDriver'

export class BitbakeTerminalProfileProvider implements vscode.TerminalProfileProvider {
  private readonly bitbakeDriver: BitbakeDriver

  constructor (bitbakeDriver: BitbakeDriver) {
    this.bitbakeDriver = bitbakeDriver
  }

  provideTerminalProfile (token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {
    const pty = new BitbakePseudoTerminal(this.bitbakeDriver)
    const command = this.bitbakeDriver.composeInteractiveCommand()
    const process = this.bitbakeDriver.spawnBitbakeProcess(command)
    void pty.runProcess(process, command)
    return {
      options: {
        name: 'Bitbake',
        pty
      } satisfies vscode.ExtensionTerminalOptions
    }
  }
}
