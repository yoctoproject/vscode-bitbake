/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as vscode from 'vscode'

/// Class representing active bitbake recipes for a bitbake project
export class BitbakeWorkspace {
  activeRecipes: string[] = []

  addActiveRecipe (recipe: string): void {
    if (this.activeRecipes.includes(recipe)) {
      return
    }
    this.activeRecipes.unshift(recipe)
    if (this.activeRecipes.length > 20) {
      this.activeRecipes.shift()
    }
  }

  dropActiveRecipe (chosenRecipe: string): void {
    const index = this.activeRecipes.indexOf(chosenRecipe)
    if (index > -1) {
      this.activeRecipes.splice(index, 1)
    }
  }

  loadBitbakeWorkspace (workspaceState: vscode.Memento): void {
    const activeRecipes = workspaceState.get('BitbakeWorkspace.activeRecipes', [])
    this.activeRecipes = activeRecipes ?? []
  }

  async saveBitbakeWorkspace (workspaceState: vscode.Memento): Promise<void> {
    await workspaceState.update('BitbakeWorkspace.activeRecipes', this.activeRecipes)
  }
}
