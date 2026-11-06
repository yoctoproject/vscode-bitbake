/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitbakeWorkspace } from './BitbakeWorkspace'
import { type ElementInfo, type BitbakeScanResult, scanContainsRecipes } from '../lib/src/types/BitbakeScanResult'
import path from 'path'
import { BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { type BitbakeDriver } from '../driver/BitbakeDriver'

export class BitbakeRecipesView {
  private readonly bitbakeTreeProvider: BitbakeTreeDataProvider
  private view: vscode.TreeView<BitbakeRecipesTreeItem> | undefined

  constructor (bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeTreeProvider = new BitbakeTreeDataProvider(bitbakeWorkspace, bitbakeProjectScanner)
    this.registerBitbakeSettingsErrorContext(bitbakeProjectScanner.bitbakeDriver)
  }

  registerView (context: vscode.ExtensionContext): void {
    this.view = vscode.window.createTreeView('bitbakeRecipes', { treeDataProvider: this.bitbakeTreeProvider, showCollapseAll: true })
    context.subscriptions.push(this.view)
    vscode.window.registerTreeDataProvider('bitbakeRecipes', this.bitbakeTreeProvider)
  }

  setTitleConfig(activeConfigName: string): void {
    if (this.view) {
      if (activeConfigName.includes("No BitBake configuration")) {
        this.view.title = 'BitBake recipes';
      } else {
        this.view.title = 'BitBake recipes [' + activeConfigName + ']';
      }
    }
  }

  private registerBitbakeSettingsErrorContext (bitbakeDriver: BitbakeDriver): void {
    const updateContext = (): void => {
      const hasSettingsError = !bitbakeDriver.isBitbakeSettingsSane()
      void vscode.commands.executeCommand('setContext', 'bitbake.settingsError', hasSettingsError)
      this.bitbakeTreeProvider.setHideRecipes(hasSettingsError)
    }

    bitbakeDriver.onBitbakeSettingsSanityChange.on('change', updateContext)
    updateContext()
  }
}

export class BitbakeRecipeTreeItem extends vscode.TreeItem {
  // Explicit that label will be string to the TypeScript compiler
  public readonly label: string

  constructor (public readonly recipe: ElementInfo | string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    const label = typeof recipe === 'string' ? recipe : recipe.name
    super(label, collapsibleState)
    this.label = label
    this.contextValue = 'bitbakeRecipeCtx'
    this.iconPath = new vscode.ThemeIcon('library')
    if (typeof recipe !== 'string' && recipe?.skipped !== undefined) {
      this.tooltip = recipe.skipped
      this.description = recipe.skipped
      this.iconPath = new vscode.ThemeIcon('warning')
    }
  }
}

export class BitbakeClassTreeItem extends vscode.TreeItem {
  public readonly label: string
  public readonly bitbakeClassName: string

  constructor (bitbakeClass: ElementInfo | string) {
    const label = typeof bitbakeClass === 'string' ? bitbakeClass : bitbakeClass.name
    super(label, vscode.TreeItemCollapsibleState.None)
    this.label = label
    this.bitbakeClassName = label
    this.collapsibleState = vscode.TreeItemCollapsibleState.None
    this.contextValue = 'bitbakeClassCtx'
    this.iconPath = new vscode.ThemeIcon('symbol-class')

    if (typeof bitbakeClass === 'string' || bitbakeClass.path === undefined) {
      this.tooltip = 'Class not found'
      this.description = 'Class not found'
      this.iconPath = new vscode.ThemeIcon('warning')
      return
    }

    const resolvedPath = path.resolve(bitbakeClass.path.dir + '/' + bitbakeClass.path.base)
    const uri: vscode.Uri = vscode.Uri.file(resolvedPath)
    this.command = { command: 'vscode.open', title: 'Open file', arguments: [uri] }
    this.description = vscode.workspace.asRelativePath(resolvedPath, false)
    this.tooltip = resolvedPath
  }
}

type BitbakeRecipesTreeItem = BitbakeRecipeTreeItem | BitbakeClassTreeItem

class BitbakeFileTreeItem extends BitbakeRecipeTreeItem {
  constructor (public readonly pathInfo: path.ParsedPath, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    const resolvedPath = path.resolve(pathInfo.dir + '/' + pathInfo.base)
    super(pathInfo.base, collapsibleState)
    this.contextValue = 'bitbakeFileCtx'
    this.iconPath = new vscode.ThemeIcon('book')
    const uri: vscode.Uri = vscode.Uri.file(resolvedPath)
    this.command = { command: 'vscode.open', title: 'Open file', arguments: [uri] }
    this.description = vscode.workspace.asRelativePath(resolvedPath, false)
    this.tooltip = resolvedPath
  }
}

class BitbakeTreeDataProvider implements vscode.TreeDataProvider<BitbakeRecipesTreeItem> {
  readonly bitbakeWorkspace: BitbakeWorkspace

  private readonly _onDidChangeTreeData: vscode.EventEmitter<BitbakeRecipesTreeItem | undefined> = new vscode.EventEmitter<BitbakeRecipesTreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<BitbakeRecipesTreeItem | undefined> = this._onDidChangeTreeData.event
  private readonly bitbakeProjectScanner: BitBakeProjectScanner
  private bitbakeScanResults: BitbakeScanResult
  private hideRecipes = false
  private scanCompletePromise: Promise<void> | undefined
  private resolveScanCompletePromise: (() => void) | undefined

  constructor (bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeWorkspace = bitbakeWorkspace
    this.bitbakeProjectScanner = bitbakeProjectScanner
    this.bitbakeScanResults = bitbakeProjectScanner.activeScanResult

    bitbakeWorkspace.onChange.on(BitbakeWorkspace.EventType.RECIPE_ADDED, () => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on(BitbakeWorkspace.EventType.RECIPE_DROPPED, () => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on(BitbakeWorkspace.EventType.CLASS_ADDED, () => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeWorkspace.onChange.on(BitbakeWorkspace.EventType.CLASS_DROPPED, () => {
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeProjectScanner.onChange.on(BitBakeProjectScanner.EventType.START_SCAN, () => {
      if (this.scanCompletePromise === undefined) {
        this.scanCompletePromise = new Promise<void>((resolve) => {
          this.resolveScanCompletePromise = resolve
        })
      }
      this._onDidChangeTreeData.fire(undefined)
    })
    bitbakeProjectScanner.onChange.on(BitBakeProjectScanner.EventType.SCAN_COMPLETE, (scanResults: BitbakeScanResult) => {
      // In case a parsing error was just introduced, we keep the previous results to keep navigation functional
      if (this.bitbakeScanResults === undefined || !scanContainsRecipes(this.bitbakeScanResults) || scanContainsRecipes(scanResults)) {
        this.bitbakeScanResults = scanResults
      }
      if (this.resolveScanCompletePromise) {
        this.resolveScanCompletePromise()
        this.resolveScanCompletePromise = undefined
      }
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: BitbakeRecipesTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  setHideRecipes (hideRecipes: boolean): void {
    this.hideRecipes = hideRecipes
    this._onDidChangeTreeData.fire(undefined)
  }

  async getChildren (element?: BitbakeRecipesTreeItem | undefined): Promise<BitbakeRecipesTreeItem[]> {
    if (this.scanCompletePromise !== undefined) {
      await this.scanCompletePromise
      this.scanCompletePromise = undefined
    }
    if (element === undefined) {
      if (this.hideRecipes) {
        return []
      }

      const items: BitbakeRecipesTreeItem[] = [
        ...this.getBitbakeRecipes(),
        ...this.getBitbakeClasses()
      ].sort((a, b) => a.label.localeCompare(b.label))
      items.push(this.getAddRecipeItem())
      return items
    }

    if (!(element instanceof BitbakeRecipeTreeItem)) {
      return []
    }

    const fileItems: BitbakeRecipeTreeItem[] = []
    this.bitbakeScanResults._recipes.forEach((recipe: ElementInfo) => {
      if (recipe.name === element.label) {
        if (recipe.path !== undefined) {
          fileItems.push(new BitbakeFileTreeItem(recipe.path, vscode.TreeItemCollapsibleState.None))
        }
        recipe.appends?.forEach((append: path.ParsedPath) => {
          fileItems.push(new BitbakeFileTreeItem(append, vscode.TreeItemCollapsibleState.None))
        })
        recipe.overlayes?.forEach((append: path.ParsedPath) => {
          fileItems.push(new BitbakeFileTreeItem(append, vscode.TreeItemCollapsibleState.None))
        })
      }
    })
    this.bitbakeScanResults._includes.forEach((include: ElementInfo) => {
      if (include.name === element.label) {
        if (include.path !== undefined) {
          fileItems.push(new BitbakeFileTreeItem(include.path, vscode.TreeItemCollapsibleState.None))
        }
      }
    })
    if (fileItems.length === 0) {
      const errorItem = new BitbakeRecipeTreeItem('Recipe not found', vscode.TreeItemCollapsibleState.None)
      errorItem.contextValue = undefined
      errorItem.iconPath = new vscode.ThemeIcon('warning')
      errorItem.command = undefined
      errorItem.tooltip = 'Recipe not found'
      fileItems.push(errorItem)
    }
    return fileItems
  }

  private getBitbakeRecipes (): BitbakeRecipeTreeItem[] {
    // Prepare a map for quick lookup. This avoids going through the list of recipes multiple times
    const recipeInfoMap = new Map<string, ElementInfo>()
    if ((this.bitbakeScanResults?._recipes) != null) {
      this.bitbakeScanResults._recipes.forEach((recipe: ElementInfo) => {
        recipeInfoMap.set(recipe.name, recipe)
      })
    }

    return this.bitbakeWorkspace.activeRecipes.map((recipe: string) => {
      const recipeInfo = recipeInfoMap.get(recipe)
      return new BitbakeRecipeTreeItem(recipeInfo ?? recipe, vscode.TreeItemCollapsibleState.Collapsed)
    })
  }

  private getBitbakeClasses (): BitbakeClassTreeItem[] {
    const classInfoMap = new Map<string, ElementInfo>()
    if ((this.bitbakeScanResults?._classes) != null) {
      this.bitbakeScanResults._classes.forEach((bitbakeClass: ElementInfo) => {
        if (!classInfoMap.has(bitbakeClass.name)) {
          classInfoMap.set(bitbakeClass.name, bitbakeClass)
        }
      })
    }

    return this.bitbakeWorkspace.activeClasses.map((bitbakeClass: string) => {
      return new BitbakeClassTreeItem(classInfoMap.get(bitbakeClass) ?? bitbakeClass)
    })
  }

  private getAddRecipeItem (): BitbakeRecipeTreeItem {
    const item = new BitbakeRecipeTreeItem('Add recipe or class', vscode.TreeItemCollapsibleState.None)
    item.command = { command: 'bitbake.watch-recipe', title: 'Add a recipe or class to the active workspace', arguments: [undefined] }
    item.iconPath = new vscode.ThemeIcon('add')
    item.contextValue = undefined
    item.tooltip = 'Add a recipe or class to the active workspace'
    return item
  }
}
