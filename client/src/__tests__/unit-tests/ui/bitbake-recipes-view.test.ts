/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeRecipeTreeItem, BitbakeRecipesView } from '../../../ui/BitbakeRecipesView'
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

        const filesItems = await treeDataProvider.getChildren(recipeItem)
        expect(filesItems).toBeDefined()
        expect(filesItems?.length).toStrictEqual(2)
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
})
