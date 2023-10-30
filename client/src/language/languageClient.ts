/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import {
  workspace,
  type ExtensionContext,
  window,
  ConfigurationTarget,
  Uri,
  commands,
  type CompletionList,
  type Hover,
  type Position
} from 'vscode'

import {
  LanguageClient,
  type LanguageClientOptions,
  TransportKind,
  type ServerOptions
} from 'vscode-languageclient/node'

const getEmbeddedLanguageDocUri = async (client: LanguageClient, uriString: string, position: Position): Promise<string> => {
  return await client.sendRequest('custom/getEmbeddedLanguageDocUri', { uriString, position })
}

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
      storagePath: context.storageUri?.fsPath
    },
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        const embeddedLanguageDocUriString = await getEmbeddedLanguageDocUri(client, document.uri.toString(), position)
        if (embeddedLanguageDocUriString === undefined) {
          return await next(document, position, context, token)
        }
        const vdocUri = Uri.parse(embeddedLanguageDocUriString)
        const result = await commands.executeCommand<CompletionList>(
          'vscode.executeCompletionItemProvider',
          vdocUri,
          position,
          context.triggerCharacter
        )
        return result
      },
      provideHover: async (document, position, token, next) => {
        const embeddedLanguageDocUriString = await getEmbeddedLanguageDocUri(client, document.uri.toString(), position)
        if (embeddedLanguageDocUriString === undefined) {
          return await next(document, position, token)
        }
        const vdocUri = Uri.parse(embeddedLanguageDocUriString)
        const result = await commands.executeCommand<Hover[]>(
          'vscode.executeHoverProvider',
          vdocUri,
          position
        )
        return result[0]
      }
    }
  }

  // Create the language client and start the client.
  const client: LanguageClient = new LanguageClient('bitbake', 'Bitbake Language Server', serverOptions, clientOptions)

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

  // Enable suggestions when inside strings, but server side disables suggestions on pure string content, they are onlyavailable in the variable expansion
  window.onDidChangeActiveTextEditor((editor) => {
    if (editor !== null && editor?.document.languageId === 'bitbake') {
      void workspace.getConfiguration('editor').update('quickSuggestions', { strings: true }, ConfigurationTarget.Workspace)
    } else {
      // Reset to default settings
      void workspace.getConfiguration('editor').update('quickSuggestions', { strings: false }, ConfigurationTarget.Workspace)
    }
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
