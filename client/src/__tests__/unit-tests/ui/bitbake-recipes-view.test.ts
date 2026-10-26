/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeClassTreeItem, type BitbakeRecipeTreeItem, BitbakeRecipesView } from '../../../ui/BitbakeRecipesView'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { mockVscodeEvents, mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode')

describe('BitbakeDriver Recipes View', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should list recipes', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const bitbakeDriver = new BitbakeDriver()
    jest.spyOn(bitbakeDriver, 'isBitbakeSettingsSane').mockReturnValue(true)
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    void bitbakeWorkspace.addActiveRecipe('base-files') // The promise is the memento which is under mock

    const contextMock = mockVscodeExtensionContext()

    const scanResult: BitbakeScanResult = {
      _recipes: [
        {
          name: 'base-files',
          path: {
            root: '/',
            dir: '/home/user/yocto/poky/meta/recipes-core/base-files',
            base: 'base-files_3.0.14',
            ext: '.bb',
            name: 'base-files'
          },
          appends: [
            {
              root: '/',
              dir: '/home/user/yocto/poky/meta/recipes-core/base-files',
              base: 'base-files_%',
              ext: '.bbappend',
              name: 'base-files'
            }
          ],
          skipped: 'skipped: because reasons'
        }
      ],
      _includes: [],
      _layers: [],
      _classes: [],
      _confFiles: [],
      _overrides: []
    }  as unknown as BitbakeScanResult

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (viewId: string, treeDataProvider: vscode.TreeDataProvider<BitbakeRecipeTreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem?.length).toStrictEqual(2)
        const recipeItem = (rootTreeItem as BitbakeRecipeTreeItem[])[0]
        expect(recipeItem.label).toStrictEqual('base-files')
        expect(recipeItem.description).toEqual('skipped: because reasons')
        expect(recipeItem.contextValue).toStrictEqual('bitbakeRecipeCtx')

        const filesItems = await treeDataProvider.getChildren(recipeItem)
        expect(filesItems).toBeDefined()
        expect(filesItems?.length).toStrictEqual(2)
        expect(rootTreeItem?.[1].label).toStrictEqual('Add recipe or class')
        expect(rootTreeItem?.[1].command).toEqual({ command: 'bitbake.watch-recipe', title: 'Add a recipe or class to the active workspace', arguments: [undefined] })
        done()
      })
    mockVscodeEvents()

    const bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitBakeProjectScanner.onChange.emit(BitBakeProjectScanner.EventType.SCAN_COMPLETE, scanResult)
    bitbakeRecipesView.registerView(contextMock)
  })

  it('should show welcome content when BitBake settings are not sane', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const bitbakeDriver = new BitbakeDriver()
    jest.spyOn(bitbakeDriver, 'isBitbakeSettingsSane').mockReturnValue(false)
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)

    const contextMock = mockVscodeExtensionContext()

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (viewId: string, treeDataProvider: vscode.TreeDataProvider<BitbakeRecipeTreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem).toStrictEqual([])
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'bitbake.settingsError', true)
        done()
      })
    mockVscodeEvents()

    const bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitbakeRecipesView.registerView(contextMock)
  })

  it('should list classes as direct file entries in the recipes view', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const bitbakeDriver = new BitbakeDriver()
    jest.spyOn(bitbakeDriver, 'isBitbakeSettingsSane').mockReturnValue(true)
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    void bitbakeWorkspace.addActiveClass('image')

    const contextMock = mockVscodeExtensionContext()
    const classPath = {
      root: '/',
      dir: '/home/user/yocto/poky/meta/classes',
      base: 'image.bbclass',
      ext: '.bbclass',
      name: 'image'
    }
    const scanResult: BitbakeScanResult = {
      _recipes: [],
      _includes: [],
      _layers: [],
      _classes: [
        {
          name: 'image',
          path: classPath
        }
      ],
      _confFiles: [],
      _overrides: []
    }  as unknown as BitbakeScanResult

    jest.spyOn(vscode.workspace, 'asRelativePath').mockImplementation((path) => path as string)
    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (_viewId: string, treeDataProvider: vscode.TreeDataProvider<vscode.TreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        const classItem = rootTreeItem?.find((item) => item.label === 'image') as BitbakeClassTreeItem

        expect(classItem).toBeDefined()
        expect(classItem.contextValue).toStrictEqual('bitbakeClassCtx')
        expect(classItem.collapsibleState).toStrictEqual(vscode.TreeItemCollapsibleState.None)
        expect(classItem.command).toEqual({
          command: 'vscode.open',
          title: 'Open file',
          arguments: ['/home/user/yocto/poky/meta/classes/image.bbclass']
        })
        expect(classItem.description).toStrictEqual('/home/user/yocto/poky/meta/classes/image.bbclass')
        expect(vscode.ThemeIcon).toHaveBeenCalledWith('symbol-class')

        const childItems = await treeDataProvider.getChildren(classItem)
        expect(childItems).toStrictEqual([])
        done()
      })
    mockVscodeEvents()

    const bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitBakeProjectScanner.onChange.emit(BitBakeProjectScanner.EventType.SCAN_COMPLETE, scanResult)
    bitbakeRecipesView.registerView(contextMock)
  })

  it('should list same-name recipes and classes together', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const bitbakeDriver = new BitbakeDriver()
    jest.spyOn(bitbakeDriver, 'isBitbakeSettingsSane').mockReturnValue(true)
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    void bitbakeWorkspace.addActiveRecipe('systemd')
    void bitbakeWorkspace.addActiveClass('systemd')

    const contextMock = mockVscodeExtensionContext()
    const scanResult: BitbakeScanResult = {
      _recipes: [
        {
          name: 'systemd',
          path: {
            root: '/',
            dir: '/home/user/yocto/poky/meta/recipes-core/systemd',
            base: 'systemd_1.0',
            ext: '.bb',
            name: 'systemd'
          }
        }
      ],
      _includes: [],
      _layers: [],
      _classes: [
        {
          name: 'systemd',
          path: {
            root: '/',
            dir: '/home/user/yocto/poky/meta/classes',
            base: 'systemd.bbclass',
            ext: '.bbclass',
            name: 'systemd'
          }
        }
      ],
      _confFiles: [],
      _overrides: []
    }  as unknown as BitbakeScanResult

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (_viewId: string, treeDataProvider: vscode.TreeDataProvider<vscode.TreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        const systemdItems = rootTreeItem?.filter((item) => item.label === 'systemd')

        expect(systemdItems).toHaveLength(2)
        expect(systemdItems?.some((item) => item.contextValue === 'bitbakeRecipeCtx')).toBe(true)
        expect(systemdItems?.some((item) => item.contextValue === 'bitbakeClassCtx')).toBe(true)
        done()
      })
    mockVscodeEvents()

    const bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitBakeProjectScanner.onChange.emit(BitBakeProjectScanner.EventType.SCAN_COMPLETE, scanResult)
    bitbakeRecipesView.registerView(contextMock)
  })
})
