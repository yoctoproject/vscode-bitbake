/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import find from 'find'
import fs from 'fs'
import path from 'path'
import vscode, {
  type CancellationToken,
  type TextDocument
} from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { BitbakeDocumentLinkProvider } from '../../documentLinkProvider'
import { RequestMethod } from '../../lib/src/types/requests'

jest.mock('vscode')

describe('BitbakeDocumentLinkProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('provides links for recipe-local files and directories', async () => {
    const recipePath = '/workspace/busybox_1.36.1.bb'
    const recipeUri = `file://${recipePath}`
    const filePath = '/workspace/busybox/defconfig'
    const directoryPath = '/workspace/busybox/patches'

    const fileRange = { id: 'file-range' } as unknown as vscode.Range
    const directoryRange = {
      id: 'directory-range'
    } as unknown as vscode.Range

    const fileUri = {
      fsPath: filePath
    } as unknown as vscode.Uri

    const directoryUri = {
      fsPath: directoryPath
    } as unknown as vscode.Uri

    const commandUri = {
      scheme: 'command'
    } as unknown as vscode.Uri

    const sendRequest = jest.fn().mockResolvedValue([
      {
        value: 'defconfig;subdir=source',
        range: fileRange
      },
      {
        value: 'patches',
        range: directoryRange
      }
    ])

    const findFiles =
      vscode.workspace.findFiles as unknown as jest.Mock

    findFiles
      .mockResolvedValueOnce([fileUri])
      .mockResolvedValueOnce([])

    jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const findDirectories =
      jest.spyOn(find, 'dirSync') as unknown as jest.Mock

    findDirectories
      .mockReturnValueOnce([directoryPath])
      .mockReturnValueOnce([])

    const parseUri = vscode.Uri.parse as unknown as jest.Mock

    parseUri
      .mockReturnValueOnce(directoryUri)
      .mockReturnValueOnce(commandUri)

    const createDocumentLink =
      vscode.DocumentLink as unknown as jest.Mock

    createDocumentLink.mockImplementation(
      (range: vscode.Range, target: vscode.Uri) => ({
        range,
        target
      })
    )

    const provider = new BitbakeDocumentLinkProvider({
      sendRequest
    } as unknown as LanguageClient)

    const document = {
      uri: {
        fsPath: recipePath,
        toString: () => recipeUri
      }
    } as unknown as TextDocument

    const token = {} as CancellationToken

    const result = await provider.provideDocumentLinks(
      document,
      token
    )

    expect(sendRequest).toHaveBeenCalledWith(
      RequestMethod.getLinksInDocument,
      {
        documentUri: recipeUri
      }
    )

    expect(findFiles).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        base: path.join('/workspace', 'busybox'),
        pattern: '**/{defconfig,patches}'
      }),
      undefined,
      2,
      token
    )

    expect(findFiles).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        base: path.join('/workspace', 'files'),
        pattern: '**/{defconfig,patches}'
      }),
      undefined,
      2,
      token
    )

    expect(findDirectories).toHaveBeenNthCalledWith(
      1,
      path.join('/workspace', 'busybox')
    )

    expect(findDirectories).toHaveBeenNthCalledWith(
      2,
      path.join('/workspace', 'files')
    )

    expect(result).toEqual([
      {
        range: fileRange,
        target: fileUri,
        tooltip: 'Bitbake: Go to file'
      },
      {
        range: directoryRange,
        target: commandUri,
        tooltip: 'Bitbake: Reveal in explorer'
      }
    ])
  })
})
