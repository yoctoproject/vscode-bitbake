/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type DevtoolWorkspaceTreeItem, DevtoolWorkspacesView } from '../../../ui/DevtoolWorkspacesView'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'

jest.mock('vscode')

describe('Devtool Worskapces View', () => {
  it('should list devtool workspaces', (done) => {
    const contextMock: vscode.ExtensionContext = {
      subscriptions: {
        push: jest.fn()
      }
    } as any

    const scanResult: BitbakeScanResult = {
      _recipes: [],
      _includes: [],
      _layers: [],
      _classes: [],
      _overrides: [],
      _workspaces: [
        {
          name: 'dropbear',
          path: '/build/workspace/dropbear'
        }
      ]
    }

    const bitBakeProjectScanner = new BitBakeProjectScanner(new BitbakeDriver())

    vscode.window.registerTreeDataProvider = jest.fn().mockImplementation(
      async (viewId: string, treeDataProvider: vscode.TreeDataProvider<DevtoolWorkspaceTreeItem>): Promise<void> => {
        const rootTreeItem = await treeDataProvider.getChildren(undefined)
        expect(rootTreeItem).toBeDefined()
        expect(rootTreeItem?.length).toStrictEqual(2)
        const recipeItem = (rootTreeItem as DevtoolWorkspaceTreeItem[])[0]
        expect(recipeItem.workspace.name).toStrictEqual('dropbear')

        done()
      })

    const devtoolWorkspacesView = new DevtoolWorkspacesView(bitBakeProjectScanner)
    bitBakeProjectScanner.onChange.emit('scanReady', scanResult)
    devtoolWorkspacesView.registerView(contextMock)
  })
})
