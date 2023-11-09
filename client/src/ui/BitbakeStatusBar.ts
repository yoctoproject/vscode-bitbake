/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitbakeScanResult } from '../lib/src/types/BitbakeScanResult'
import { type BitBakeProjectScannerClient } from '../language/BitbakeProjectScannerClient'

export class BitbakeStatusBar {
  private bitbakeScanResults: BitbakeScanResult = { recipes: [], includes: [] }
  private readonly bitbakeProjectScannerClient: BitBakeProjectScannerClient
  readonly statusBarItem: vscode.StatusBarItem

  constructor (bitbakeProjectScannerClient: BitBakeProjectScannerClient) {
    this.bitbakeProjectScannerClient = bitbakeProjectScannerClient
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
    this.statusBarItem.text = '$(loading~spin) BitBake: Scanning...'
    this.statusBarItem.show()
    this.bitbakeProjectScannerClient.onChange.on('scanReady', (bitbakeScanResult: BitbakeScanResult) => {
      this.bitbakeScanResults = bitbakeScanResult
      this.updateStatusBar()
    })
  }

  updateStatusBar (): void {
    if (this.bitbakeScanResults.recipes.length > 0) {
      this.statusBarItem.text = '$(library) BitBake: ' + this.bitbakeScanResults.recipes.length + ' recipes parsed'
      this.statusBarItem.command = 'bitbake.rescan-project'
      this.statusBarItem.tooltip = 'BitBake: Scan project for recipes'
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
    } else {
      this.statusBarItem.text = '$(error) BitBake: Parsing error'
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.statusBarItem.command = 'workbench.action.problems.focus'
      this.statusBarItem.tooltip = 'Open problems view for more details'
    }
  }

  // TODO report new scan
  // TODO report new parsing status
}
