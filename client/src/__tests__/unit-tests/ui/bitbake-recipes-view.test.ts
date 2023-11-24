/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeRecipeTreeItem, BitbakeRecipesView } from '../../../ui/BitbakeRecipesView'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { bitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'

jest.mock('vscode')

describe('BitbakeDriver Recipes View', () => {
  it('should list recipes', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    bitbakeWorkspace.addActiveRecipe('base-files')

    const contextMock: vscode.ExtensionContext = {
      subscriptions: {
        push: jest.fn()
      }
    } as any

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
          ]
        }
      ],
      _includes: [],
      _layers: [],
      _classes: [],
      _overrides: []
    }

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (viewId: string, treeDataProvider: vscode.TreeDataProvider<BitbakeRecipeTreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem?.length).toStrictEqual(2)
        const recipeItem = (rootTreeItem as BitbakeRecipeTreeItem[])[0]
        expect(recipeItem.label).toStrictEqual('base-files')

        const filesItems = await treeDataProvider.getChildren(recipeItem)
        expect(filesItems).toBeDefined()
        expect(filesItems?.length).toStrictEqual(2)
        done()
      })

    const bitbakeRecipesView = new BitbakeRecipesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitbakeRecipesView.registerView(contextMock)
    bitBakeProjectScanner.onChange.emit('scanReady', scanResult)
  })
})
