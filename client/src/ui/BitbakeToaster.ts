/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as child_process from 'child_process'

import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { clientNotificationManager } from './ClientNotificationManager'
import { runBitbakeTerminalCustomCommand } from './BitbakeTerminal'
import { finishProcessExecution } from '../utils/ProcessUtils'

export class BitbakeToaster {
  private started = false

  constructor (private readonly bitbakeDriver: BitbakeDriver) {}

  private openBrowser (): void {
    const DEFAULT_TOASTER_PORT = 8000
    const url = `http://localhost:${DEFAULT_TOASTER_PORT}`

    void vscode.env.openExternal(vscode.Uri.parse(url)).then(success => {
      if (!success) {
        void vscode.window.showErrorMessage(`Failed to open URL ${url}`)
      }
    })
  }

  async startInBrowser (): Promise<void> {
    if (this.started) {
      this.openBrowser()
      clientNotificationManager.showToasterStarted()
      return
    }

    const command = `nohup bash -c "${this.bitbakeDriver.composeToasterCommand('start')}"`
    const process = await runBitbakeTerminalCustomCommand(
      this.bitbakeDriver,
      command,
      'Toaster'
    )

    process.onExit((event) => {
      if (event.exitCode !== 0) {
        void vscode.window.showErrorMessage(
          `Failed to start Toaster with exit code ${event.exitCode}. See terminal output.`
        )
        return
      }

      this.started = true
      this.openBrowser()
      clientNotificationManager.showToasterStarted()
    })
  }

  async stop (): Promise<void> {
    if (this.started === false) {
      void vscode.window.showInformationMessage('Toaster has not been started')
      return
    }

    const command = this.bitbakeDriver.composeToasterCommand('stop')
    const process = runBitbakeTerminalCustomCommand(
      this.bitbakeDriver,
      command,
      'Toaster'
    )

    await finishProcessExecution(process)
    this.started = false
  }

  async stopOnShutdown (): Promise<void> {
    if (this.started === false) {
      return
    }

    const command = this.bitbakeDriver.composeToasterCommand('stop')
    const script = this.bitbakeDriver.composeBitbakeScript(command)

    // We can't spawn terminals or ptys when closing the extension, so we use child_process to stop Toaster
    // Use BitbakeTerminals to spawn commands outside of this context! This is a special shutdown case.
    child_process.execSync(script, { shell: '/bin/bash' })
    this.started = false
  }
}
