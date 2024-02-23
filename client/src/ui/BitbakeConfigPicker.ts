/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeSettings } from '../lib/src/BitbakeSettings'
import assert from 'assert'

export let activeBuildConfiguration: string = 'No BitBake configuration'

export class BitbakeConfigPicker {
  readonly statusBarItem: vscode.StatusBarItem
  private bitbakeSettings: BitbakeSettings

  constructor (bitbakeSettings: BitbakeSettings, context: vscode.ExtensionContext) {
    this.bitbakeSettings = bitbakeSettings
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0)

    this.updateStatusBar(bitbakeSettings)
  }

  updateStatusBar (bitbakeSettings: BitbakeSettings): void {
    this.bitbakeSettings = bitbakeSettings
    if (this.bitbakeSettings?.buildConfigurations !== undefined && this.bitbakeSettings?.buildConfigurations?.length > 0) {
      if (this.bitbakeSettings?.buildConfigurations.find((config) => config.name === activeBuildConfiguration) === undefined) {
        assert(this.bitbakeSettings.buildConfigurations[0].name !== undefined) // Cannot happen with the definition in client/package.json
        activeBuildConfiguration = this.bitbakeSettings.buildConfigurations[0].name
      }
      this.statusBarItem.text = activeBuildConfiguration
      this.statusBarItem.show()
    } else {
      activeBuildConfiguration = 'No BitBake configuration'
      this.statusBarItem.hide()
    }
  }
}
