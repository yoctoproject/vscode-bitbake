/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitbakeTerminalLinkProvider } from '../../../ui/BitbakeTerminalLinkProvider'
import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import * as fs from 'fs'
import os from 'os'
import path from 'path'

describe('BitbakeTerminalLinkProvider', () => {
  const bitBakeProjectScanner = jest.fn() as unknown as BitBakeProjectScanner
  const linkProvider: BitbakeTerminalLinkProvider = new BitbakeTerminalLinkProvider(bitBakeProjectScanner)

  function mockScanner (): void {
    bitBakeProjectScanner.needsContainerPathsResolution = jest.fn().mockReturnValue(true)
    bitBakeProjectScanner.resolveContainerPath = jest.fn().mockImplementation((path: string) => {
      return 'resolved' + path
    })
  }

  function mockTerminalLink (): void {
    (vscode.TerminalLink as jest.Mock).mockImplementation((startIndex: number, length: number, tooltip: string) => {
      return { startIndex, length, tooltip }
    })
  }

  beforeEach(() => {
    mockScanner()
    mockTerminalLink()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return an empty array if container paths resolution is not needed', async () => {
    const context = { line: 'some line without absolute links ./abcd;(123)' } as unknown as vscode.TerminalLinkContext

    const result = await linkProvider.provideTerminalLinks(context)

    expect(result).toEqual([])
  })

  it('should return an array of TerminalLinks for container paths', async () => {
    const context = { line: 'some line "/path/to/file:123" with a link' } as unknown as vscode.TerminalLinkContext
    const result = await linkProvider.provideTerminalLinks(context)
    expect(result).toHaveLength(1)
    expect(result[0].startIndex).toBe(11)
    expect(result[0].length).toBe(13)
    expect(result[0].tooltip).toBe('resolved' + '/path/to/file')
  })


  it('should reveal directory links in the explorer', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bitbake-terminal-link-'))

    try {
      const link = {
        tooltip: tempDirectory
      } as unknown as vscode.TerminalLink

      linkProvider.handleTerminalLink(link)

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'revealInExplorer',
        vscode.Uri.file(tempDirectory)
      )
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true })
    }
  })
})
