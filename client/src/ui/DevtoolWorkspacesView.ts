/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeScanResult, type DevtoolWorkspaceInfo } from '../lib/src/types/BitbakeScanResult'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'

export class DevtoolWorkspacesView {
  private readonly devtoolTreeProvider: DevtoolTreeDataProvider

  constructor (bitbakeProjectScanner: BitBakeProjectScanner) {
    this.devtoolTreeProvider = new DevtoolTreeDataProvider(bitbakeProjectScanner)
  }

  registerView (context: vscode.ExtensionContext): void {
    const view = vscode.window.createTreeView('devtoolWorkspaces', { treeDataProvider: this.devtoolTreeProvider, showCollapseAll: true })
    context.subscriptions.push(view)
    vscode.window.registerTreeDataProvider('devtoolWorkspaces', this.devtoolTreeProvider)
  }
}

// TODO refactor common code between both views
class DevtoolTreeDataProvider implements vscode.TreeDataProvider<DevtoolWorkspaceTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<DevtoolWorkspaceTreeItem | undefined> = new vscode.EventEmitter<DevtoolWorkspaceTreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<DevtoolWorkspaceTreeItem | undefined> = this._onDidChangeTreeData.event
  private readonly bitbakeProjectScanner: BitBakeProjectScanner
  private bitbakeScanResults: BitbakeScanResult = { _layers: [], _classes: [], _includes: [], _recipes: [], _overrides: [], _workspaces: [] }

  constructor (bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeProjectScanner = bitbakeProjectScanner

    bitbakeProjectScanner.onChange.on('scanReady', (scanResults: BitbakeScanResult) => {
      // In case a parsing error was just introduced, we keep the previous results to keep navigation functional
      if (this.bitbakeScanResults._recipes.length === 0 || scanResults._recipes.length > 0) {
        this.bitbakeScanResults = scanResults
      }
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: DevtoolWorkspaceTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  getChildren (element?: DevtoolWorkspaceTreeItem | undefined): vscode.ProviderResult<DevtoolWorkspaceTreeItem[]> {
    if (element === undefined) {
      const items = this.getDevtoolWorkspaces()
      items.push(this.getAddWorkspaceItem())
      return items
    }

    // No children for devtool workspaces
    return []
  }

  private getDevtoolWorkspaces (): DevtoolWorkspaceTreeItem[] {
    return this.bitbakeScanResults._workspaces.map((workspace: DevtoolWorkspaceInfo) => {
      return new DevtoolWorkspaceTreeItem(workspace)
    })
  }

  private getAddWorkspaceItem (): DevtoolWorkspaceTreeItem {
    const item = new DevtoolWorkspaceTreeItem({ name: 'New devtool workspace', path: '' })
    item.command = { command: 'bitbake.devtool-modify', title: 'Open a new devtool workspace to modify a recipe\'s sources', arguments: [undefined] }
    item.iconPath = new vscode.ThemeIcon('edit')
    item.contextValue = undefined
    item.tooltip = 'Open a new devtool workspace to modify a recipe\'s sources'
    return item
  }
}

export class DevtoolWorkspaceTreeItem extends vscode.TreeItem {
  constructor (public readonly workspace: DevtoolWorkspaceInfo) {
    super(workspace.name, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'devtoolWorskpaceCtx'
    this.iconPath = new vscode.ThemeIcon('folder')
    this.command = {
      command: 'bitbake.devtool-open-workspace',
      title: 'Open sources workspace in a new window',
      arguments: [
        workspace.name
      ]
    }
    this.tooltip = "Open the workspace's sources in a new window"
  }
}
