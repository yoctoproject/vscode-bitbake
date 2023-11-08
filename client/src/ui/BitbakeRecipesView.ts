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

export class BitbakeRecipe extends vscode.TreeItem {
  constructor (public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState)
    this.contextValue = 'bitbakeRecipeCtx'
  }
}

class BitbakeTreeDataProvider implements vscode.TreeDataProvider<BitbakeRecipe> {
  readonly bitbakeWorkspace: BitbakeWorkspace

  private readonly _onDidChangeTreeData: vscode.EventEmitter<BitbakeRecipe | undefined> = new vscode.EventEmitter<BitbakeRecipe | undefined>()
  readonly onDidChangeTreeData: vscode.Event<BitbakeRecipe | undefined> = this._onDidChangeTreeData.event

  constructor (bitbakeWorkspace: BitbakeWorkspace) {
    this.bitbakeWorkspace = bitbakeWorkspace

    bitbakeWorkspace.onChange.on('recipeAdded', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on('recipeDropped', (recipe: string) => {
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: BitbakeRecipe): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  getChildren (element?: BitbakeRecipe | undefined): vscode.ProviderResult<BitbakeRecipe[]> {
    if (element === undefined) {
      return this.getBitbakeRecipes()
    }
    throw new Error('getChildren not implemented.')
  }

  private getBitbakeRecipes (): BitbakeRecipe[] {
    return this.bitbakeWorkspace.activeRecipes.map((recipe: string) => {
      return new BitbakeRecipe(recipe, vscode.TreeItemCollapsibleState.None)
    })
  }
}
