/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { EventEmitter } from 'events'
import type * as vscode from 'vscode'

/// Class representing active BitBake recipes and classes for a BitBake project
export class BitbakeWorkspace {
  activeRecipes: string[] = []
  activeClasses: string[] = []
  private memento: vscode.Memento | undefined

  public static readonly EventType = {
    RECIPE_ADDED: 'recipeAdded',
    RECIPE_DROPPED: 'recipeDropped',
    CLASS_ADDED: 'classAdded',
    CLASS_DROPPED: 'classDropped'
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

  async addActiveClass (bitbakeClass: string): Promise<void> {
    if (this.activeClasses.includes(bitbakeClass)) {
      return
    }
    this.activeClasses.unshift(bitbakeClass)
    if (this.activeClasses.length > 20) {
      this.activeClasses.pop()
    }
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.CLASS_ADDED, bitbakeClass)
  }

  async dropActiveClass (chosenClass: string): Promise<void> {
    const index = this.activeClasses.indexOf(chosenClass)
    if (index > -1) {
      this.activeClasses.splice(index, 1)
    }
    if (this.memento !== undefined) {
      await this.saveBitbakeWorkspace(this.memento)
    }
    this.onChange.emit(BitbakeWorkspace.EventType.CLASS_DROPPED, chosenClass)
  }

  loadBitbakeWorkspace (workspaceState: vscode.Memento): void {
    const activeRecipes = workspaceState.get('BitbakeWorkspace.activeRecipes', [])
    const activeClasses = workspaceState.get('BitbakeWorkspace.activeClasses', [])
    this.activeRecipes = activeRecipes ?? []
    this.activeClasses = activeClasses ?? []
    this.memento = workspaceState
  }

  async saveBitbakeWorkspace (workspaceState: vscode.Memento): Promise<void> {
    await workspaceState.update('BitbakeWorkspace.activeRecipes', this.activeRecipes)
    await workspaceState.update('BitbakeWorkspace.activeClasses', this.activeClasses)
  }
}
