/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { EventEmitter } from 'events'
import type * as vscode from 'vscode'

export interface ActiveRecipe {
  name: string
  isClass: boolean
}

/// Class representing active BitBake recipes and classes for a BitBake project
export class BitbakeWorkspace {
  activeRecipes: ActiveRecipe[] = []
  private memento: vscode.Memento | undefined

  public static readonly EventType = {
    RECIPE_ADDED: 'recipeAdded',
    RECIPE_DROPPED: 'recipeDropped'
  }

  onChange: EventEmitter = new EventEmitter()

  async addActiveRecipe (recipe: string, isClass: boolean = false): Promise<void> {
    if (this.activeRecipes.some((activeRecipe) => activeRecipe.name === recipe && activeRecipe.isClass === isClass)) {
      return
    }
    this.activeRecipes.unshift({ name: recipe, isClass })
    if (this.activeRecipes.length > 20) {
      this.activeRecipes.shift()
    }
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.RECIPE_ADDED, recipe)
  }

  async dropActiveRecipe (chosenRecipe: string, isClass: boolean = false): Promise<void> {
    const index = this.activeRecipes.findIndex((recipe) => recipe.name === chosenRecipe && recipe.isClass === isClass)
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
    const activeRecipes = workspaceState.get<Array<ActiveRecipe | string>>('BitbakeWorkspace.activeRecipes', [])
    this.activeRecipes = (activeRecipes ?? []).map((recipe) => typeof recipe === 'string' ? { name: recipe, isClass: false } : recipe)
    this.memento = workspaceState
  }

  async saveBitbakeWorkspace (workspaceState: vscode.Memento): Promise<void> {
    await workspaceState.update('BitbakeWorkspace.activeRecipes', this.activeRecipes)
  }
}
