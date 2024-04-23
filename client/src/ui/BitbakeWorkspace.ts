/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { EventEmitter } from 'events'
import type * as vscode from 'vscode'

/// Class representing active bitbake recipes for a bitbake project
export class BitbakeWorkspace {
  activeRecipes: string[] = []
  private memento: vscode.Memento | undefined

  public static readonly EventType = {
    RECIPE_ADDED: 'recipeAdded',
    RECIPE_DROPPED: 'recipeDropped'
  }

  onChange: EventEmitter = new EventEmitter()

  async addActiveRecipe (recipe: string): Promise<void> {
    if (this.activeRecipes.includes(recipe)) {
      return
    }
    this.activeRecipes.unshift(recipe)
    if (this.activeRecipes.length > 20) {
      this.activeRecipes.shift()
    }
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.RECIPE_ADDED, recipe)
  }

  async dropActiveRecipe (chosenRecipe: string): Promise<void> {
    const index = this.activeRecipes.indexOf(chosenRecipe)
    if (index > -1) {
      this.activeRecipes.splice(index, 1)
    }
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.RECIPE_DROPPED, chosenRecipe)
  }

  async dropAllActiveRecipes (): Promise<void> {
    this.activeRecipes = []
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.RECIPE_DROPPED)
  }

  loadBitbakeWorkspace (workspaceState: vscode.Memento): void {
    const activeRecipes = workspaceState.get('BitbakeWorkspace.activeRecipes', [])
    this.activeRecipes = activeRecipes ?? []
    this.memento = workspaceState
  }

  async saveBitbakeWorkspace (workspaceState: vscode.Memento): Promise<void> {
    await workspaceState.update('BitbakeWorkspace.activeRecipes', this.activeRecipes)
  }
}
