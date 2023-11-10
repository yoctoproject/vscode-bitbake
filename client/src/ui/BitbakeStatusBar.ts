/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { type BitbakeScanResult } from '../lib/src/types/BitbakeScanResult'
import { type BitBakeProjectScannerClient } from '../language/BitbakeProjectScannerClient'
import { lastParsingExitCode } from './BitbakeTaskProvider'

export class BitbakeStatusBar {
  private bitbakeScanResults: BitbakeScanResult = { recipes: [], includes: [] }
  private readonly bitbakeProjectScannerClient: BitBakeProjectScannerClient
  readonly statusBarItem: vscode.StatusBarItem
  private scanInProgress = false
  private parsingInProgress = false
  private scanExitCode = 0

  constructor (bitbakeProjectScannerClient: BitBakeProjectScannerClient) {
    this.bitbakeProjectScannerClient = bitbakeProjectScannerClient
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
    this.updateStatusBar()
    this.statusBarItem.show()

    this.bitbakeProjectScannerClient.onChange.on('scanReady', (bitbakeScanResult: BitbakeScanResult) => {
      this.scanInProgress = false
      this.bitbakeScanResults = bitbakeScanResult
      this.updateStatusBar()
    })
    this.bitbakeProjectScannerClient.onChange.on('startScan', () => {
      this.scanInProgress = true
      this.updateStatusBar()
    })

    vscode.tasks.onDidStartTask((e: vscode.TaskStartEvent) => {
      if (e.execution.task.name === 'Parse all recipes' && e.execution.task.source === 'bitbake') {
        this.parsingInProgress = true
        this.updateStatusBar()
      }
    })
    vscode.tasks.onDidEndTask((e: vscode.TaskEndEvent) => {
      if (e.execution.task.name === 'Parse all recipes' && e.execution.task.source === 'bitbake') {
        this.parsingInProgress = false
        this.scanExitCode = lastParsingExitCode
        this.updateStatusBar()
      }
    })
  }

  updateStatusBar (): void {
    if (this.scanInProgress || this.parsingInProgress) {
      if (this.scanInProgress) {
        this.statusBarItem.text = '$(loading~spin) BitBake: Scanning...'
        this.statusBarItem.tooltip = 'BitBake: Scanning...'
      } else {
        this.statusBarItem.text = '$(loading~spin) BitBake: Parsing...'
        this.statusBarItem.tooltip = 'BitBake: Parsing...'
      }
      this.statusBarItem.command = undefined
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
      return
    }
    if (this.scanExitCode !== 0 || this.bitbakeScanResults.recipes.length === 0) {
      this.statusBarItem.text = '$(error) BitBake: Parsing error'
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.statusBarItem.command = 'workbench.action.problems.focus'
      this.statusBarItem.tooltip = 'Open problems view for more details'
    } else {
      this.statusBarItem.text = '$(library) BitBake: ' + this.bitbakeScanResults.recipes.length + ' recipes parsed'
      this.statusBarItem.command = 'bitbake.rescan-project'
      this.statusBarItem.tooltip = 'BitBake: Scan project for recipes'
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
    }
  }
}
