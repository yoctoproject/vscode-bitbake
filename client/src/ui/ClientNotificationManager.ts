/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Memento, commands, window } from 'vscode'

export class ClientNotificationManager {
  private _memento: Memento | undefined

  setMemento (memento: Memento): void {
    this._memento = memento
  }

  showBitbakeError (message?: string): void {
    if (this.checkIsNeverShowAgain('custom/bitbakeSettingsError')) {
      void window.showErrorMessage(
        'BitBake could not be configured and started. To enable advanced Bitbake features, please configure the Bitbake extension.\n\n' + message,
        'Open Settings',
        'Close',
        'Never Show Again'
      )
        .then((item) => {
          if (item === 'Open Settings') {
            void commands.executeCommand('workbench.action.openWorkspaceSettings', '@ext:yocto-project.yocto-bitbake')
          } else if (item === 'Never Show Again') {
            void this.neverShowAgain('custom/bitbakeSettingsError')
          }
        })
    }
  }

  private neverShowAgain (method: string): Thenable<void> {
    if (this._memento === undefined) {
      throw new Error('ClientNotificationManager Memento not set')
    }
    return this._memento.update(`neverShowAgain/${method}`, true)
  }

  private checkIsNeverShowAgain (method: string): boolean {
    if (this._memento === undefined) {
      throw new Error('ClientNotificationManager Memento not set')
    }
    return this._memento.get(`neverShowAgain/${method}`, false)
  }

  async resetNeverShowAgain (method: string): Promise<void> {
    if (this._memento === undefined) {
      throw new Error('ClientNotificationManager Memento not set')
    }
    await this._memento.update(`neverShowAgain/${method}`, false)
  }
}

export const clientNotificationManager: ClientNotificationManager = new ClientNotificationManager()
