/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import * as vscode from 'vscode'

import { BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { type BitbakeScanResult, type ElementInfo } from '../lib/src/types/BitbakeScanResult'
import { BitbakeWorkspace } from './BitbakeWorkspace'

export class BitbakeClassesView {
  private readonly bitbakeTreeProvider: BitbakeClassesTreeDataProvider
  private view: vscode.TreeView<BitbakeClassTreeItem> | undefined

  constructor (bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeTreeProvider = new BitbakeClassesTreeDataProvider(bitbakeWorkspace, bitbakeProjectScanner)
    this.registerBitbakeSettingsErrorContext(bitbakeProjectScanner.bitbakeDriver)
  }

  registerView (context: vscode.ExtensionContext): void {
    this.view = vscode.window.createTreeView('bitbakeClasses', { treeDataProvider: this.bitbakeTreeProvider, showCollapseAll: true })
    context.subscriptions.push(this.view)
    vscode.window.registerTreeDataProvider('bitbakeClasses', this.bitbakeTreeProvider)
  }

  setTitleConfig (activeConfigName: string): void {
    if (this.view) {
      if (activeConfigName.includes('No BitBake configuration')) {
        this.view.title = 'BitBake classes'
      } else {
        this.view.title = 'BitBake classes [' + activeConfigName + ']'
      }
    }
  }

  private registerBitbakeSettingsErrorContext (bitbakeDriver: BitbakeDriver): void {
    const updateContext = (): void => {
      const hasSettingsError = !bitbakeDriver.isBitbakeSettingsSane()
      void vscode.commands.executeCommand('setContext', 'bitbake.settingsError', hasSettingsError)
      this.bitbakeTreeProvider.setHideClasses(hasSettingsError)
    }

    bitbakeDriver.onBitbakeSettingsSanityChange.on('change', updateContext)
    updateContext()
  }
}

export class BitbakeClassTreeItem extends vscode.TreeItem {
  public readonly label: string

  constructor (public readonly bitbakeClass: ElementInfo | string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    const label = typeof bitbakeClass === 'string' ? bitbakeClass : bitbakeClass.name
    super(label, collapsibleState)
    this.label = label
    this.contextValue = 'bitbakeClassCtx'
    this.iconPath = new vscode.ThemeIcon('symbol-class')
  }
}

class BitbakeClassFileTreeItem extends BitbakeClassTreeItem {
  constructor (public readonly pathInfo: path.ParsedPath, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    const resolvedPath = path.resolve(pathInfo.dir + '/' + pathInfo.base)
    super(pathInfo.base, collapsibleState)
    this.contextValue = 'bitbakeClassFileCtx'
    this.iconPath = new vscode.ThemeIcon('book')
    const uri: vscode.Uri = vscode.Uri.file(resolvedPath)
    this.command = { command: 'vscode.open', title: 'Open file', arguments: [uri] }
    this.description = vscode.workspace.asRelativePath(resolvedPath, false)
    this.tooltip = resolvedPath
  }
}

class BitbakeClassesTreeDataProvider implements vscode.TreeDataProvider<BitbakeClassTreeItem> {
  private readonly _onDidChangeTreeData: vscode.EventEmitter<BitbakeClassTreeItem | undefined> = new vscode.EventEmitter<BitbakeClassTreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<BitbakeClassTreeItem | undefined> = this._onDidChangeTreeData.event
  private bitbakeScanResults: BitbakeScanResult
  private hideClasses = false
  private scanCompletePromise: Promise<void> | undefined
  private resolveScanCompletePromise: (() => void) | undefined

  constructor (private readonly bitbakeWorkspace: BitbakeWorkspace, bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeScanResults = bitbakeProjectScanner.activeScanResult

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
      this.bitbakeScanResults = scanResults
      if (this.resolveScanCompletePromise) {
        this.resolveScanCompletePromise()
        this.resolveScanCompletePromise = undefined
      }
      this._onDidChangeTreeData.fire(undefined)
    })
  }

  getTreeItem (element: BitbakeClassTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  setHideClasses (hideClasses: boolean): void {
    this.hideClasses = hideClasses
    this._onDidChangeTreeData.fire(undefined)
  }

  async getChildren (element?: BitbakeClassTreeItem | undefined): Promise<BitbakeClassTreeItem[]> {
    if (this.scanCompletePromise !== undefined) {
      await this.scanCompletePromise
      this.scanCompletePromise = undefined
    }
    if (element === undefined) {
      if (this.hideClasses) {
        return []
      }

      const items = this.getBitbakeClasses()
      items.push(this.getAddClassItem())
      return items
    }

    const fileItems: BitbakeClassTreeItem[] = []
    this.bitbakeScanResults._classes.forEach((bitbakeClass: ElementInfo) => {
      if (bitbakeClass.name === element.label && bitbakeClass.path !== undefined) {
        fileItems.push(new BitbakeClassFileTreeItem(bitbakeClass.path, vscode.TreeItemCollapsibleState.None))
      }
    })
    if (fileItems.length === 0) {
      const errorItem = new BitbakeClassTreeItem('Class not found', vscode.TreeItemCollapsibleState.None)
      errorItem.contextValue = undefined
      errorItem.iconPath = new vscode.ThemeIcon('warning')
      errorItem.command = undefined
      errorItem.tooltip = 'Class not found'
      fileItems.push(errorItem)
    }
    return fileItems
  }

  private getBitbakeClasses (): BitbakeClassTreeItem[] {
    const classInfoMap = new Map<string, ElementInfo>()
    if ((this.bitbakeScanResults?._classes) != null) {
      this.bitbakeScanResults._classes.forEach((bitbakeClass: ElementInfo) => {
        classInfoMap.set(bitbakeClass.name, bitbakeClass)
      })
    }

    return this.bitbakeWorkspace.activeClasses.map((bitbakeClass: string) => {
      const classInfo = classInfoMap.get(bitbakeClass)
      return new BitbakeClassTreeItem(classInfo ?? bitbakeClass, vscode.TreeItemCollapsibleState.Collapsed)
    }).sort((a, b) => a.label.localeCompare(b.label))
  }

  private getAddClassItem (): BitbakeClassTreeItem {
    const item = new BitbakeClassTreeItem('Add class', vscode.TreeItemCollapsibleState.None)
    item.command = { command: 'bitbake.watch-class', title: 'Add a class to the active workspace', arguments: [undefined] }
    item.iconPath = new vscode.ThemeIcon('add')
    item.contextValue = undefined
    item.tooltip = 'Add a class to the active workspace'
    return item
  }
}
