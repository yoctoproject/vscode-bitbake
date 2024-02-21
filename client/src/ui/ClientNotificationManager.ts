/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Memento, commands, window } from 'vscode'
import { logger } from '../lib/src/utils/OutputLogger'

export class ClientNotificationManager {
  private _memento: Memento | undefined

  setMemento (memento: Memento): void {
    this._memento = memento
  }

  showBitbakeSettingsError (message?: string): void {
    logger.error('BitBake settings error: ' + message)
    if (!this.checkIsNeverShowAgain('bitbake/bitbakeSettingsError')) {
      void window.showErrorMessage(
        'BitBake could not be configured and started. To enable advanced Bitbake features, please configure the Bitbake extension.\n\n' + message,
        'Open Settings',
        'Close',
        'Don\'t Show Again'
      )
        .then((item) => {
          if (item === 'Open Settings') {
            void commands.executeCommand('workbench.action.openWorkspaceSettings', '@ext:yocto-project.yocto-bitbake')
          } else if (item === 'Don\'t Show Again') {
            void this.neverShowAgain('bitbake/bitbakeSettingsError')
          }
        }, (reason) => {
          logger.warn('Could not show bitbake error dialog: ' + reason)
        })
    }
  }

  showSDKUnavailableError (recipe: string): void {
    void window.showErrorMessage('Your version of devtool does not seem to support the `ide-sdk` command. Please update poky to enable SDK features. Alternatively, use the "Devtool: SDK fallback" command with less features.',
      'Run devtool SDK fallback',
      'Close'
    )
      .then((item) => {
        if (item === 'Run devtool SDK fallback') {
          void commands.executeCommand('bitbake.devtool-sdk-fallback', recipe)
        }
      }, (reason) => {
        logger.warn('Could not show bitbake error dialog: ' + reason)
      })
  }

  showSDKSuggestion (recipe: string): void {
    if (!this.checkIsNeverShowAgain('bitbake/sdkSuggestion')) {
      window.showInformationMessage(
        `Would you like to configure the SDK for ${recipe}?
It looks like you just configured a new devtool workspace.
You can configure the sources' workspace to use the Yocto SDK for cross-compilation and debugging.`,
        'Configure SDK',
        'Don\'t Show Again'
      )
        .then((item) => {
          if (item === 'Configure SDK') {
            void commands.executeCommand('bitbake.devtool-ide-sdk', recipe)
          } else if (item === 'Don\'t Show Again') {
            void this.neverShowAgain('bitbake/sdkSuggestion')
          }
        }, (reason) => {
          logger.warn('Could not show SDK suggestion dialog: ' + reason)
        })
    }
  }

  showSDKConfigurationError (): void {
    void window.showErrorMessage(
      'The BitBake SDK hasn\'t been fully configured yet, please complete your settings.',
      'Open Settings',
      'Close'
    )
      .then((item) => {
        if (item === 'Open Settings') {
          void commands.executeCommand('workbench.action.openWorkspaceSettings', '@ext:yocto-project.yocto-bitbake sdk')
        }
      }, (reason) => {
        logger.warn('Could not show bitbake error dialog: ' + reason)
      })
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
