/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import {
  workspace,
  type ExtensionContext,
  window,
  languages,
  TabInputText
} from 'vscode'

import {
  LanguageClient,
  type LanguageClientOptions,
  TransportKind,
  type ServerOptions
} from 'vscode-languageclient/node'
import { middlewareProvideCompletion } from './middlewareCompletion'
import { middlewareProvideHover } from './middlewareHover'
import { requestsManager } from './RequestManager'
import { middlewareProvideDefinition } from './middlewareDefinition'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { logger } from '../lib/src/utils/OutputLogger'
import { NotificationMethod, type NotificationParams } from '../lib/src/types/notifications'
import { updateDiagnostics } from './diagnosticsSupport'
import { getLanguageConfiguration } from './languageConfiguration'
import { BitbakeCodeActionProvider } from './codeActionProvider'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import * as vscode from 'vscode'
import { middlewareProvideReferences } from './middlewareReferences'
import { RequestMethod, type RequestParams, type RequestResult } from '../lib/src/types/requests'
import { BitbakeDocumentLinkProvider } from '../documentLinkProvider'

export async function activateLanguageServer (context: ExtensionContext, bitBakeProjectScanner: BitBakeProjectScanner): Promise<LanguageClient> {
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'))
  // The debug options for the server
  // Use --inspect-brk instead of --inspect if you want to debug the server startup code
  const debugOptions = { execArgv: ['--nolazy', '--inspect=localhost:6010'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  }

  const sendSettings = async (): Promise<void> => {
    const settings = workspace.getConfiguration()
    try {
      await client.sendNotification('workspace/didChangeConfiguration', { settings })
    } catch (error) {
      logger.error('Failed to send settings to language server: ' + String(error))
    }
  }

  workspace.onDidChangeConfiguration(sendSettings)

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for bitbake documents
    // TODO: check new documentSelector
    documentSelector: [{ scheme: 'file', language: 'bitbake' }],
    middleware: {
      provideCompletionItem: middlewareProvideCompletion,
      provideDefinition: middlewareProvideDefinition,
      provideHover: middlewareProvideHover,
      provideReferences: middlewareProvideReferences
    }
  }

  languages.setLanguageConfiguration('bitbake', getLanguageConfiguration())

  languages.onDidChangeDiagnostics(e => {
    e.uris.forEach(uri => {
      void updateDiagnostics(uri)
    })
  })

  context.subscriptions.push(
    languages.registerCodeActionsProvider('bitbake', new BitbakeCodeActionProvider())
  )

  if (context.storageUri?.fsPath === undefined) {
    logger.error('Failed to get storage path')
  } else {
    await embeddedLanguageDocsManager.setStoragePath(context.storageUri.fsPath)
  }

  // Create the language client and start the client.
  const client: LanguageClient = new LanguageClient('bitbake', 'Bitbake Language Server', serverOptions, clientOptions)
  requestsManager.client = client

  client.onRequest('bitbake/resolveContainerPath', async (uri) => {
    return await bitBakeProjectScanner.resolveContainerPath(uri, true)
  })

  client.onRequest(RequestMethod.getRecipeLocalFiles, async (params: RequestParams['getRecipeLocalFiles']): Promise<RequestResult['getRecipeLocalFiles']> => {
    if (params.uri === undefined) {
      logger.error(`[${RequestMethod.getRecipeLocalFiles}] No uri is provided`)
      return { foundFileUris: [], foundDirs: [] }
    }

    const { pnDir, filesDir } = BitbakeDocumentLinkProvider.getLocalFoldersForRecipeUri(params.uri)

    const filePatterns = [
      { base: pnDir, pattern: '**/*' },
      { base: filesDir, pattern: '**/*' }
    ]
    const { foundFiles, foundDirs } = await BitbakeDocumentLinkProvider.findFilesAndDirs(filePatterns, [pnDir, filesDir])

    return { foundFileUris: foundFiles.map(uri => uri.fsPath), foundDirs }
  })

  client.onNotification(NotificationMethod.EmbeddedLanguageDocs, (embeddedLanguageDocs: NotificationParams['EmbeddedLanguageDocs']) => {
    void embeddedLanguageDocsManager.saveEmbeddedLanguageDocs(embeddedLanguageDocs)
  })

  window.tabGroups.onDidChangeTabs((event) => {
    [...event.opened, ...event.changed].forEach((tab) => {
      if (tab.input instanceof TabInputText) {
        const uri = tab.input.uri
        if (embeddedLanguageDocsManager.embeddedLanguageDocsFolder === undefined) {
          return
        }
        // Close embedded document tabs when they open automatically
        if (uri.fsPath.includes(embeddedLanguageDocsManager.embeddedLanguageDocsFolder)) {
          if (
            // Prevent prompt to appear on unsaved files
            !tab.isDirty &&
            // Make possible to open embedded documents in a tab
            !tab.isPreview && !tab.isActive && !tab.isPinned
          ) {
            void window.tabGroups.close(tab, false)
          }
        }
      }
    })
  })

  // Start the client and launch the server
  await client.start()
  await sendSettings()

  return client
}

export async function deactivateLanguageServer (client: LanguageClient): Promise<void> {
  await Promise.all([
    embeddedLanguageDocsManager.deleteEmbeddedLanguageDocsFolder(),
    client.stop()
  ])
}

export async function getScanResult<
  MethodName extends string,
  ParamsType extends { recipe: string },
  ReturnType
> (
  client: LanguageClient,
  methodName: MethodName,
  params: ParamsType,
  canTriggerScan: boolean = false
): Promise<ReturnType | undefined> {
  try {
    let value: ReturnType = await client.sendRequest(methodName, params)
    if ((value === undefined || value === null) && canTriggerScan) {
      // We may not have scanned the recipe yet. Let's try again.
      const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: `Recipe ${params.recipe} has not been scanned yet. Scanning now...`,
        cancellable: false
      }
      await vscode.window.withProgress(progressOptions, async (progress) => {
        await vscode.commands.executeCommand('bitbake.scan-recipe-env', params.recipe)
        progress.report({ increment: 100 })
      })
      value = await client.sendRequest(methodName, params)
    }
    logger.debug(`[getScanResult] (${methodName}): ${JSON.stringify(params)}, ${JSON.stringify(value)}`)
    return value ?? undefined
  } catch (error) {
    logger.error(`Failed to get scan result: ${String(error)}`)
  }
}

export async function getVariableValue (
  client: LanguageClient,
  variable: string, recipe: string,
  canTriggerScan: boolean = false
): Promise<string | undefined> {
  return await getScanResult(client, RequestMethod.getVar, { variable, recipe }, canTriggerScan)
}

export async function getAllVariableValues (
  client: LanguageClient,
  recipe: string,
  canTriggerScan: boolean = false
): Promise<Array<{ name: string, value: string }> | undefined> {
  return await getScanResult(client, RequestMethod.getAllVar, { recipe }, canTriggerScan)
}
