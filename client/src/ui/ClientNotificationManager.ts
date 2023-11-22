/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Memento, commands, window } from 'vscode'
import { type LanguageClient, type Disposable } from 'vscode-languageclient/node'

export class ClientNotificationManager {
  private readonly _client: LanguageClient
  private readonly _memento: Memento

  constructor (client: LanguageClient, memento: Memento) {
    this._client = client
    this._memento = memento
  }

  buildHandlers (): Disposable[] {
    const handlers = [
      this.bitBakeSettingsErrorHandler()
    ]

    return handlers
  }

  private bitBakeSettingsErrorHandler (): Disposable {
    const isNeverShowAgain = this.checkIsNeverShowAgain('custom/bitbakeSettingsError')
    if (isNeverShowAgain) {
      return { dispose: () => {} }
    }
    return this._client.onNotification('custom/bitbakeSettingsError', (message?: string) => {
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
    })
  }

  private neverShowAgain (method: string): Thenable<void> {
    return this._memento.update(`neverShowAgain/${method}`, true)
  }

  private checkIsNeverShowAgain (method: string): boolean {
    return this._memento.get(`neverShowAgain/${method}`, false)
  }
}
