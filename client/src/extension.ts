/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { ClientNotificationManager } from './ui/ClientNotificationManager'
import { logger } from './ui/OutputLogger'
import { activateLanguageServer, deactivateLanguageServer } from './language/languageClient'
import { BitbakeDriver } from './driver/BitbakeDriver'
import { BitbakeTaskProvider } from './ui/BitbakeTaskProvider'
import { buildRecipeCommand, cleanRecipeCommand } from './ui/BitbakeCommands'
import { BitbakeWorkspace } from './ui/BitbakeWorkspace'

let client: LanguageClient
const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let bitbakeTaskProvider: BitbakeTaskProvider
let taskProvider: vscode.Disposable
const bitbakeWorkspace: BitbakeWorkspace = new BitbakeWorkspace()
export let bitbakeExtensionContext: vscode.ExtensionContext

export async function activate (context: vscode.ExtensionContext): Promise<void> {
  bitbakeExtensionContext = context
  bitbakeDriver.loadSettings()
  bitbakeWorkspace.loadBitbakeWorkspace(context.workspaceState)
  bitbakeTaskProvider = new BitbakeTaskProvider(bitbakeDriver)
  client = await activateLanguageServer(context)

  taskProvider = vscode.tasks.registerTaskProvider('bitbake', bitbakeTaskProvider)

  const notificationManager = new ClientNotificationManager(client, context.globalState)
  context.subscriptions.push(...notificationManager.buildHandlers())

  // Handle settings change for bitbake driver
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('bitbake')) {
      bitbakeDriver.loadSettings()
      logger.debug('Bitbake settings changed')
    }
    if (event.affectsConfiguration('bitbake.loggingLevel')) {
      logger.loadSettings()
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', async () => { await buildRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider) }))
  context.subscriptions.push(vscode.commands.registerCommand('bitbake.clean-recipe', async () => { await cleanRecipeCommand(bitbakeWorkspace, bitbakeTaskProvider) }))

  logger.info('Congratulations, your extension "BitBake" is now active!')
}

export function deactivate (): Thenable<void> | undefined {
  taskProvider.dispose()
  return deactivateLanguageServer(client)
}
