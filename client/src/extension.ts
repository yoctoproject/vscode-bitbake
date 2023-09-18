/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import { workspace } from 'vscode'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

import type { ExtensionContext } from 'vscode'
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'

let client: LanguageClient
export async function activate (context: ExtensionContext): Promise<void> {
  console.log('Congratulations, your extension "BitBake" is now active!')
  const serverModule = context.asAbsolutePath(path.join('../server', 'out', 'server.js'))
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
    }
  }

  // Create the language client and start the client.
  client = new LanguageClient('bitbake', 'Language Server Bitbake', serverOptions, clientOptions)

  // Start the client and launch the server
  await client.start()
}

export function deactivate (): Thenable<void> | undefined {
  if (client === undefined) {
    return undefined
  }
  return client.stop()
}
