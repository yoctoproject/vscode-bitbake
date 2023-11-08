/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeWorkspace } from './BitbakeWorkspace'
import { type BitBakeProjectScannerClient } from '../language/BitbakeProjectScannerClient'
import { type ElementInfo, type BitbakeScanResult, type PathInfo } from '../lib/src/types/BitbakeScanResult'
import path from 'path'

export class BitbakeRecipesView {
  private readonly bitbakeTreeProvider: BitbakeTreeDataProvider

  constructor (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScannerClient: BitBakeProjectScannerClient) {
    this.bitbakeTreeProvider = new BitbakeTreeDataProvider(bitbakeWorkspace, bitbakeProjectScannerClient)

    const view = vscode.window.createTreeView('bitbakeRecipes', { treeDataProvider: this.bitbakeTreeProvider, showCollapseAll: true })
    context.subscriptions.push(view)
    vscode.window.registerTreeDataProvider('bitbakeRecipes', this.bitbakeTreeProvider)
  }
}

export class BitbakeRecipeTreeItem extends vscode.TreeItem {
  constructor (public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState)
    this.contextValue = 'bitbakeRecipeCtx'
    this.iconPath = new vscode.ThemeIcon('library')
  }
}

class BitbakeFileTreeItem extends BitbakeRecipeTreeItem {
  constructor (public readonly pathInfo: PathInfo, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    const resolvedPath = path.resolve(pathInfo.dir + '/' + pathInfo.base)
    super(pathInfo.base, collapsibleState)
    this.contextValue = 'bitbakeFileCtx'
    this.iconPath = new vscode.ThemeIcon('book')
    this.command = { command: 'vscode.open', title: 'Open file', arguments: [resolvedPath] }
    this.description = resolvedPath
    this.tooltip = resolvedPath
  }
}

class BitbakeTreeDataProvider implements vscode.TreeDataProvider<BitbakeRecipeTreeItem> {
  readonly bitbakeWorkspace: BitbakeWorkspace

  private readonly _onDidChangeTreeData: vscode.EventEmitter<BitbakeRecipeTreeItem | undefined> = new vscode.EventEmitter<BitbakeRecipeTreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<BitbakeRecipeTreeItem | undefined> = this._onDidChangeTreeData.event
  bitbakeProjectScannerClient: BitBakeProjectScannerClient

  constructor (bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScannerClient: BitBakeProjectScannerClient) {
    this.bitbakeWorkspace = bitbakeWorkspace
    this.bitbakeProjectScannerClient = bitbakeProjectScannerClient

    bitbakeWorkspace.onChange.on('recipeAdded', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on('recipeDropped', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeProjectScannerClient.onChange.on('scanReady', (scanResults: BitbakeScanResult) => {
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: BitbakeRecipeTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  getChildren (element?: BitbakeRecipeTreeItem | undefined): vscode.ProviderResult<BitbakeRecipeTreeItem[]> {
    if (element === undefined) {
      const items = this.getBitbakeRecipes()
      items.push(this.getAddRecipeItem())
      return items
    }

    const fileItems: BitbakeRecipeTreeItem[] = []
    this.bitbakeProjectScannerClient.bitbakeScanResult.recipes.forEach((recipe: ElementInfo) => {
      if (recipe.name === element.label) {
        if (recipe.path !== undefined) {
          fileItems.push(new BitbakeFileTreeItem(recipe.path, vscode.TreeItemCollapsibleState.None))
        }
        recipe.appends?.forEach((append: PathInfo) => {
          fileItems.push(new BitbakeFileTreeItem(append, vscode.TreeItemCollapsibleState.None))
        })
        recipe.overlayes?.forEach((append: PathInfo) => {
          fileItems.push(new BitbakeFileTreeItem(append, vscode.TreeItemCollapsibleState.None))
        })
      }
    })
    this.bitbakeProjectScannerClient.bitbakeScanResult.includes.forEach((include: ElementInfo) => {
      if (include.name === element.label) {
        if (include.path !== undefined) {
          fileItems.push(new BitbakeFileTreeItem(include.path, vscode.TreeItemCollapsibleState.None))
        }
      }
    })
    return fileItems
  }

  private getBitbakeRecipes (): BitbakeRecipeTreeItem[] {
    return this.bitbakeWorkspace.activeRecipes.map((recipe: string) => {
      return new BitbakeRecipeTreeItem(recipe, vscode.TreeItemCollapsibleState.Collapsed)
    })
  }

  private getAddRecipeItem (): BitbakeRecipeTreeItem {
    const item = new BitbakeRecipeTreeItem('Add recipe', vscode.TreeItemCollapsibleState.None)
    item.command = { command: 'bitbake.watch-recipe', title: 'Add a recipe to the active workspace', arguments: [undefined] }
    item.iconPath = new vscode.ThemeIcon('add')
    item.contextValue = undefined
    return item
  }
}
