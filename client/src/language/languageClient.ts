/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import {
  workspace,
  type ExtensionContext,
  window,
  commands
} from 'vscode'

import {
  LanguageClient,
  type LanguageClientOptions,
  TransportKind,
  type ServerOptions
} from 'vscode-languageclient/node'
import { NotificationMethod, type NotificationParams } from '../lib/src/types/notifications'
import { middlewareProvideCompletion } from './middlewareCompletion'
import { middlewareProvideHover } from './middlewareHover'
import { requestsManager } from './RequestManager'
import { middlewareProvideDefinition } from './middlewareDefinition'

const notifyFileRenameChanged = async (
  client: LanguageClient,
  oldUriString: string,
  newUriString: string
): Promise<void> => {
  const params: NotificationParams['FilenameChanged'] = { oldUriString, newUriString }
  await client.sendNotification(NotificationMethod.FilenameChanged, params)
}

export async function activateLanguageServer (context: ExtensionContext): Promise<LanguageClient> {
  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'))
  // The debug options for the server
  // Use --inspect-brk instead of --inspect if you want to debug the server startup code
  const debugOptions = { execArgv: ['--nolazy', '--inspect=localhost:6010'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  }

  workspace.onDidRenameFiles((params) => {
    params.files.forEach((file) => {
      void notifyFileRenameChanged(client, file.oldUri.toString(), file.newUri.toString())
    })
  })

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for bitbake documents
    // TODO: check new documentSelector
    documentSelector: [{ scheme: 'file', language: 'bitbake' }],
    initializationOptions: {
      storagePath: context.storageUri?.fsPath,
      extensionPath: context.extensionPath
    },
    middleware: {
      provideCompletionItem: middlewareProvideCompletion,
      provideDefinition: middlewareProvideDefinition,
      provideHover: middlewareProvideHover
    }
  }

  // Create the language client and start the client.
  const client: LanguageClient = new LanguageClient('bitbake', 'Bitbake Language Server', serverOptions, clientOptions)
  requestsManager.client = client

  client.onRequest('custom/verifyConfigurationFileAssociation', async (param) => {
    if (param.filePath?.endsWith('.conf') === true) {
      const doc = await workspace.openTextDocument(param.filePath)
      const { languageId } = doc
      //  The modifications from other extensions may happen later than this handler, hence the setTimeOut
      setTimeout(() => {
        if (languageId !== 'bitbake') {
          void window.showErrorMessage(`Failed to associate this file (${param.filePath}) with BitBake Language mode. Current language mode: ${languageId}. Please make sure there is no other extension that is causing the conflict. (e.g. Txt Syntax)`)
        }
      }, 1000)
    }
  })

  client.onRequest('bitbake/parseAllRecipes', async () => {
    // Temporarily disable task.saveBeforeRun
    // This request happens on bitbake document save. We don't want to save all files when any bitbake file is saved.
    const saveBeforeRun = await workspace.getConfiguration('task').get('saveBeforeRun')
    await workspace.getConfiguration('task').update('saveBeforeRun', 'never', undefined, true)
    await commands.executeCommand('bitbake.parse-recipes')
    await workspace.getConfiguration('task').update('saveBeforeRun', saveBeforeRun, undefined, true)
  })

  client.onRequest('bitbake/rescanProject', async () => {
    return await commands.executeCommand('bitbake.rescan-project')
  })

  // Start the client and launch the server
  await client.start()

  return client
}

export async function deactivateLanguageServer (client: LanguageClient): Promise<void> {
  if (client === undefined) {
    return undefined
  }
  await client.stop()
}
