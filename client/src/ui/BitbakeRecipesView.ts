/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeWorkspace } from './BitbakeWorkspace'

export class BitbakeRecipesView {
  private readonly bitbakeTreeProvider: BitbakeTreeDataProvider

  constructor (context: vscode.ExtensionContext, bitbakeWorkspace: BitbakeWorkspace) {
    this.bitbakeTreeProvider = new BitbakeTreeDataProvider(bitbakeWorkspace)

    const view = vscode.window.createTreeView('bitbakeRecipes', { treeDataProvider: this.bitbakeTreeProvider, showCollapseAll: true })
    context.subscriptions.push(view)
    vscode.window.registerTreeDataProvider('bitbakeRecipes', this.bitbakeTreeProvider)
  }
}

export class BitbakeRecipeTreeItem extends vscode.TreeItem {
  constructor (public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, contextValue: string = 'bitbakeRecipeCtx') {
    super(label, collapsibleState)
    this.contextValue = contextValue
  }
}

class BitbakeTreeDataProvider implements vscode.TreeDataProvider<BitbakeRecipeTreeItem> {
  readonly bitbakeWorkspace: BitbakeWorkspace

  private readonly _onDidChangeTreeData: vscode.EventEmitter<BitbakeRecipeTreeItem | undefined> = new vscode.EventEmitter<BitbakeRecipeTreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<BitbakeRecipeTreeItem | undefined> = this._onDidChangeTreeData.event

  constructor (bitbakeWorkspace: BitbakeWorkspace) {
    this.bitbakeWorkspace = bitbakeWorkspace

    bitbakeWorkspace.onChange.on('recipeAdded', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on('recipeDropped', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: BitbakeRecipeTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  getChildren (element?: BitbakeRecipeTreeItem | undefined): vscode.ProviderResult<BitbakeRecipeTreeItem[]> {
    if (element === undefined) {
      const items = this.getBitbakeRecipes()
      return items
    }
    throw new Error('getChildren not implemented.')
  }

  private getBitbakeRecipes (): BitbakeRecipeTreeItem[] {
    return this.bitbakeWorkspace.activeRecipes.map((recipe: string) => {
      return new BitbakeRecipeTreeItem(recipe, vscode.TreeItemCollapsibleState.None)
    })
  }
}
