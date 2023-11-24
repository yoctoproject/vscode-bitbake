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
import { middlewareProvideCompletion } from './middlewareCompletion'
import { middlewareProvideHover } from './middlewareHover'
import { requestsManager } from './RequestManager'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { logger } from '../lib/src/utils/OutputLogger'
import { NotificationMethod, type NotificationParams } from '../lib/src/types/notifications'

export async function activateLanguageServer (context: ExtensionContext): Promise<LanguageClient> {
  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'))
  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  }

  workspace.onDidRenameFiles((params) => {
    params.files.forEach((file) => {
      embeddedLanguageDocsManager.renameEmbeddedLanguageDocs(file.oldUri.toString(), file.newUri.toString())
    })
  })

  workspace.onDidDeleteFiles((params) => {
    params.files.forEach((file) => {
      void embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(file.toString())
    })
  })

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for bitbake documents
    // TODO: check new documentSelector
    documentSelector: [{ scheme: 'file', language: 'bitbake' }],
    synchronize: {
      configurationSection: 'bitbake',

      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.bbclass', false, true, false),
        workspace.createFileSystemWatcher('**/*.inc', false, true, false),
        workspace.createFileSystemWatcher('**/*.bb', false, true, false),
        workspace.createFileSystemWatcher('**/*.conf', false, true, false)
      ]
    },
    initializationOptions: {
      extensionPath: context.extensionPath
    },
    middleware: {
      provideCompletionItem: middlewareProvideCompletion,
      provideHover: middlewareProvideHover
    }
  }

  if (context.storageUri?.fsPath === undefined) {
    logger.error('Failed to get storage path')
  } else {
    void embeddedLanguageDocsManager.setStoragePath(context.storageUri.fsPath)
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
    return await commands.executeCommand('bitbake.parse-recipes')
  })

  client.onRequest('bitbake/rescanProject', async () => {
    return await commands.executeCommand('bitbake.rescan-project')
  })

  client.onNotification(NotificationMethod.EmbeddedLanguageDocs, (embeddedLanguageDocs: NotificationParams['EmbeddedLanguageDocs']) => {
    void embeddedLanguageDocsManager.saveEmbeddedLanguageDocs(embeddedLanguageDocs)
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
