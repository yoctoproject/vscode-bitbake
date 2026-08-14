/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { type BitbakeDriver } from '../../../driver/BitbakeDriver'
import { type BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { type BitbakeScanResult } from '../../../lib/src/types/BitbakeScanResult'
import { registerBitbakeDocumentLifecycle } from '../../../ui/BitbakeDocumentLifecycle'

jest.mock('vscode')

type DocumentHandler = (document: vscode.TextDocument) => void | Promise<void>

function createDocument (
  fsPath: string,
  languageId = 'bitbake'
): vscode.TextDocument {
  return {
    uri: { fsPath },
    languageId
  } as unknown as vscode.TextDocument
}

function visibleEditors (): vscode.TextEditor[] {
  return vscode.window.visibleTextEditors as unknown as vscode.TextEditor[]
}

function createHarness (recipeNames: string[] = []): {
  closeHandler: DocumentHandler
  saveHandler: DocumentHandler
  sendNotification: jest.Mock
  isBitbakeSettingsSane: jest.Mock
  checkBitbakeSettingsSanity: jest.Mock
} {
  const sendNotification = jest.fn()
  const isBitbakeSettingsSane = jest.fn().mockReturnValue(true)
  const checkBitbakeSettingsSanity = jest.fn().mockResolvedValue(true)

  const driver = {
    isBitbakeSettingsSane,
    checkBitbakeSettingsSanity
  } as unknown as BitbakeDriver

  const scanResult = {
    _recipes: recipeNames.map((name) => ({ name }))
  } as BitbakeScanResult

  const scanner = {
    activeScanResult: scanResult
  } as unknown as BitBakeProjectScanner

  const client = {
    sendNotification
  } as unknown as LanguageClient

  registerBitbakeDocumentLifecycle(driver, scanner, client)

  const closeRegistration =
    vscode.workspace.onDidCloseTextDocument as unknown as jest.Mock
  const saveRegistration =
    vscode.workspace.onDidSaveTextDocument as unknown as jest.Mock

  expect(closeRegistration).toHaveBeenCalledTimes(1)
  expect(saveRegistration).toHaveBeenCalledTimes(1)

  return {
    closeHandler: closeRegistration.mock.calls[0][0] as DocumentHandler,
    saveHandler: saveRegistration.mock.calls[0][0] as DocumentHandler,
    sendNotification,
    isBitbakeSettingsSane,
    checkBitbakeSettingsSanity
  }
}

describe('BitbakeDocumentLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    const disposable = { dispose: jest.fn() }

    const closeRegistration =
      vscode.workspace.onDidCloseTextDocument as unknown as jest.Mock
    const saveRegistration =
      vscode.workspace.onDidSaveTextDocument as unknown as jest.Mock
    const getConfiguration =
      vscode.workspace.getConfiguration as unknown as jest.Mock

    closeRegistration.mockReturnValue(disposable)
    saveRegistration.mockReturnValue(disposable)
    getConfiguration.mockReturnValue({
      get: jest.fn().mockReturnValue(true)
    })

    visibleEditors().length = 0
  })

  it('removes the scan result when the last recipe document closes', () => {
    const { closeHandler, sendNotification } = createHarness()

    closeHandler(createDocument('/layers/foo.bb'))

    expect(sendNotification).toHaveBeenCalledWith(
      'bitbake/removeScanResult',
      { recipeName: 'foo' }
    )
  })

  it('keeps the scan result while a related recipe document remains visible', () => {
    visibleEditors().push({
      document: createDocument('/layers/foo.bb')
    } as vscode.TextEditor)

    const { closeHandler, sendNotification } = createHarness()

    closeHandler(createDocument('/layers/foo.bbappend'))

    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('ignores saved documents that are not BitBake documents', async () => {
    const { saveHandler } = createHarness()

    await saveHandler(createDocument('/layers/foo.py', 'python'))

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('does nothing when parse-on-save is disabled', async () => {
    const getConfiguration =
      vscode.workspace.getConfiguration as unknown as jest.Mock

    getConfiguration.mockReturnValue({
      get: jest.fn().mockReturnValue(false)
    })

    const { saveHandler } = createHarness()

    await saveHandler(createDocument('/layers/foo.bb'))

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('does nothing when BitBake settings fail the sanity check', async () => {
    const {
      saveHandler,
      isBitbakeSettingsSane,
      checkBitbakeSettingsSanity
    } = createHarness()

    isBitbakeSettingsSane.mockReturnValue(false)
    checkBitbakeSettingsSanity.mockResolvedValue(false)

    await saveHandler(createDocument('/layers/foo.bb'))

    expect(checkBitbakeSettingsSanity).toHaveBeenCalledTimes(1)
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
  })

  it('scans the recipe environment for a known saved recipe', async () => {
    const { saveHandler } = createHarness(['foo'])
    const document = createDocument('/layers/foo.bb')

    await saveHandler(document)

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'bitbake.scan-recipe-env',
      document.uri
    )
  })

  it('scans the global environment for configuration files', async () => {
    const { saveHandler } = createHarness()

    await saveHandler(createDocument('/build/conf/local.conf'))

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'bitbake.scan-global-env'
    )
  })

  it('falls back to parsing recipes for other saved BitBake files', async () => {
    const { saveHandler } = createHarness()

    await saveHandler(createDocument('/layers/unknown.bb'))

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'bitbake.parse-recipes'
    )
  })
})
