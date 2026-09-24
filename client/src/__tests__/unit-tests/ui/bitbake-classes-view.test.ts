/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeClassTreeItem, BitbakeClassesView } from '../../../ui/BitbakeClassesView'
import { BitbakeWorkspace } from '../../../ui/BitbakeWorkspace'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { mockVscodeEvents, mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode')

describe('BitbakeDriver Classes View', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('lists active classes from scanned classes with a class-specific context', (done) => {
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
            base: 'systemd_255.13',
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
      _overrides: [],
      _workspaces: [],
      _bitbakeVersion: ''
    }

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (viewId: string, treeDataProvider: vscode.TreeDataProvider<BitbakeClassTreeItem>): Promise<void> => {
        expect(viewId).toStrictEqual('bitbakeClasses')
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem?.length).toStrictEqual(2)
        const classItem = (rootTreeItem as BitbakeClassTreeItem[])[0]
        expect(classItem.label).toStrictEqual('systemd')
        expect(classItem.contextValue).toStrictEqual('bitbakeClassCtx')
        expect(classItem.contextValue).not.toStrictEqual('bitbakeRecipeCtx')

        const filesItems = await treeDataProvider.getChildren(classItem)
        expect(filesItems).toBeDefined()
        expect(filesItems?.length).toStrictEqual(1)
        expect(filesItems?.[0].label).toStrictEqual('systemd.bbclass')
        expect(filesItems?.[0].tooltip).toStrictEqual('/home/user/yocto/poky/meta/classes/systemd.bbclass')
        done()
      })
    mockVscodeEvents()

    const bitbakeClassesView = new BitbakeClassesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitBakeProjectScanner.onChange.emit(BitBakeProjectScanner.EventType.SCAN_COMPLETE, scanResult)
    bitbakeClassesView.registerView(contextMock)
  })

  it('shows missing class and add class items', (done) => {
    const bitbakeWorkspace = new BitbakeWorkspace()
    const bitbakeDriver = new BitbakeDriver()
    jest.spyOn(bitbakeDriver, 'isBitbakeSettingsSane').mockReturnValue(true)
    const bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    void bitbakeWorkspace.addActiveClass('missing')

    const contextMock = mockVscodeExtensionContext()

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (_viewId: string, treeDataProvider: vscode.TreeDataProvider<BitbakeClassTreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem?.length).toStrictEqual(2)
        expect(rootTreeItem?.[1].label).toStrictEqual('Add class')
        expect(rootTreeItem?.[1].command).toEqual({ command: 'bitbake.watch-class', title: 'Add a class to the active workspace', arguments: [undefined] })

        const filesItems = await treeDataProvider.getChildren(rootTreeItem?.[0])
        expect(filesItems).toBeDefined()
        expect(filesItems?.length).toStrictEqual(1)
        expect(filesItems?.[0].label).toStrictEqual('Class not found')
        expect(filesItems?.[0].contextValue).toBeUndefined()
        done()
      })
    mockVscodeEvents()

    const bitbakeClassesView = new BitbakeClassesView(bitbakeWorkspace, bitBakeProjectScanner)
    bitbakeClassesView.registerView(contextMock)
  })
})
