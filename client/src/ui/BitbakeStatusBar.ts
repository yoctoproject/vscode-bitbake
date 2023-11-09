/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/*
    Bitbake status Bar showing scan in progress and scan results/errors
*/

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
    this.statusBarItem.text = 'BitBake: scanning...'
    this.statusBarItem.command = 'bitbake.rescan-project'
    this.statusBarItem.tooltip = 'BitBake: Rescan Project'
    this.statusBarItem.show()
    this.bitbakeProjectScannerClient.onChange.on('scanReady', (bitbakeScanResult: BitbakeScanResult) => {
      this.bitbakeScanResults = bitbakeScanResult
      this.updateStatusBar()
    })
  }

  updateStatusBar (): void {
    if (this.bitbakeScanResults.recipes.length > 0) {
      this.statusBarItem.text = 'BitBake: ' + this.bitbakeScanResults.recipes.length + ' recipes found'
      this.statusBarItem.tooltip = 'BitBake: Scan project for recipes'
    } else {
      this.statusBarItem.text = 'BitBake: no recipes found'
      this.statusBarItem.tooltip = 'BitBake: Scan project for recipes'
    }
  }

  // TODO report parsing error
  // TODO report new scan
  // TODO report new parsing
  // TODO use icons for more readability
}
