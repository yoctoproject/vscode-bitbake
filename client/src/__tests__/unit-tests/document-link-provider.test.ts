/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fg from 'fast-glob'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
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

    const fileRange = {
      id: 'file-range'
    } as unknown as vscode.Range

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

    const entries = [
      {
        name: 'defconfig',
        path: filePath,
        dirent: {
          isDirectory: () => false,
          isFile: () => true
        }
      },
      {
        name: 'patches',
        path: directoryPath,
        dirent: {
          isDirectory: () => true,
          isFile: () => false
        }
      }
    ]

    const streamSpy = jest.spyOn(fg, 'stream')
      .mockReturnValue(
        Readable.from(
          entries,
          { objectMode: true }
        ) as unknown as ReturnType<typeof fg.stream>
      )

    jest.spyOn(vscode.Uri, 'file')
      .mockReturnValue(fileUri)

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

    const provider = new BitbakeDocumentLinkProvider({
      sendRequest
    } as unknown as LanguageClient)

    const document = {
      uri: {
        fsPath: recipePath,
        toString: () => recipeUri
      }
    } as unknown as TextDocument

    const token = {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn(
        () => ({ dispose: jest.fn() })
      )
    } as unknown as CancellationToken

    const result = await provider.provideDocumentLinks(
      document,
      token
    )

    expect(sendRequest).toHaveBeenCalledWith(
      RequestMethod.getLinksInDocument,
      { documentUri: recipeUri }
    )

    expect(streamSpy).toHaveBeenCalledTimes(1)

    expect(streamSpy).toHaveBeenCalledWith(
      [
        `${
          fg.convertPathToPattern(
            path.join('/workspace', 'busybox')
          )
        }/**/defconfig`,
        `${
          fg.convertPathToPattern(
            path.join('/workspace', 'busybox')
          )
        }/**/patches`,
        `${
          fg.convertPathToPattern(
            path.join('/workspace', 'files')
          )
        }/**/defconfig`,
        `${
          fg.convertPathToPattern(
            path.join('/workspace', 'files')
          )
        }/**/patches`
      ],
      expect.objectContaining({
        absolute: true,
        objectMode: true,
        onlyFiles: false
      })
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

  it('does not scan recipe-local files for .conf documents', async () => {
    const sendRequest = jest.fn()
    const streamSpy = jest.spyOn(fg, 'stream')
    const readdirSpy = jest.spyOn(
      fs.promises,
      'readdir'
    )

    const provider = new BitbakeDocumentLinkProvider({
      sendRequest
    } as unknown as LanguageClient)

    const document = {
      uri: {
        fsPath: '/workspace/build.conf'
      }
    } as unknown as TextDocument

    const result = await provider.provideDocumentLinks(
      document,
      {} as CancellationToken
    )

    expect(result).toEqual([])
    expect(sendRequest).not.toHaveBeenCalled()
    expect(streamSpy).not.toHaveBeenCalled()
    expect(readdirSpy).not.toHaveBeenCalled()
  })

  it('does not start a scan when already cancelled', async () => {
    const streamSpy = jest.spyOn(fg, 'stream')

    const result =
      await BitbakeDocumentLinkProvider.findFilesAndDirs(
        ['/workspace/**/*'],
        undefined,
        {
          isCancellationRequested: true
        } as CancellationToken
      )

    expect(result).toEqual({
      foundFiles: [],
      foundDirs: []
    })

    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('destroys an active scan when cancelled', async () => {
    const scanStream = new Readable({
      objectMode: true,
      read: () => {}
    })

    const destroySpy = jest.spyOn(
      scanStream,
      'destroy'
    )

    jest.spyOn(fg, 'stream').mockReturnValue(
      scanStream as unknown as ReturnType<typeof fg.stream>
    )

    let cancelled = false
    let cancelScan: (() => void) | undefined
    const dispose = jest.fn()

    const token = {
      get isCancellationRequested () {
        return cancelled
      },
      onCancellationRequested: jest.fn(
        (callback: () => void) => {
          cancelScan = callback
          return { dispose }
        }
      )
    } as unknown as CancellationToken

    const scan =
      BitbakeDocumentLinkProvider.findFilesAndDirs(
        ['/workspace/**/*'],
        undefined,
        token
      )

    expect(cancelScan).toBeDefined()

    cancelled = true
    cancelScan?.()

    const result = await scan

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)

    expect(result).toEqual({
      foundFiles: [],
      foundDirs: []
    })
  })
})
