import * as path from 'path'

import {
  workspace,
  ExtensionContext
} from 'vscode'

import {
  LanguageClient,
  LanguageClientOptions,
  TransportKind,
  ServerOptions
} from 'vscode-languageclient/node'

export async function activateLanguageServer(context: ExtensionContext) : Promise<LanguageClient> {
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
  let client : LanguageClient = new LanguageClient('bitbake', 'Bitbake Language Server', serverOptions, clientOptions)

  // Start the client and launch the server
  await client.start()

  return client
}

export async function deactivateLanguageServer(client: LanguageClient): Promise<void> {
  if (client === undefined) {
    return undefined
  }
  return client.stop()
}
