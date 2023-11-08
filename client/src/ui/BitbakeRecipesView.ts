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

class BitbakeRecipe extends vscode.TreeItem {
  constructor (public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState)
    this.tooltip = `${this.label}`
    this.description = this.label
  }
}

class BitbakeTreeDataProvider implements vscode.TreeDataProvider<BitbakeRecipe> {
  readonly bitbakeWorkspace: BitbakeWorkspace

  readonly onDidChangeTreeData: vscode.Event<BitbakeRecipe | undefined> = new vscode.EventEmitter<BitbakeRecipe | undefined>().event

  constructor (bitbakeWorkspace: BitbakeWorkspace) {
    this.bitbakeWorkspace = bitbakeWorkspace
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
