/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */


import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import { ClientNotificationManager } from './ui/ClientNotificationManager'
import { logger } from './ui/OutputLogger';
import { activateLanguageServer, deactivateLanguageServer } from './language/languageClient';
import { BitbakeDriver } from './driver/BitbakeDriver';
import { BitbakeTaskProvider } from './ui/BitbakeTaskProvider';
import { buildRecipeCommand } from './ui/BitbakeCommands'
import { BitbakeWorkspace } from './ui/BitbakeWorkspace';

let client: LanguageClient
let bitbakeDriver: BitbakeDriver = new BitbakeDriver()
let taskProvider: vscode.Disposable;
let bitbakeWorkspace: BitbakeWorkspace = { activeRecipes: ["core-image-minimal"] };

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  bitbakeDriver.loadSettings()
  client = await activateLanguageServer(context)

  taskProvider = vscode.tasks.registerTaskProvider('bitbake', new BitbakeTaskProvider(bitbakeDriver))

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
  }) )

  context.subscriptions.push(vscode.commands.registerCommand('bitbake.build-recipe', () => buildRecipeCommand(bitbakeWorkspace)))

  logger.info('Congratulations, your extension "BitBake" is now active!')
}

export function deactivate (): Thenable<void> | undefined {
  if (taskProvider) {
    taskProvider.dispose();
}
  return deactivateLanguageServer(client)
}
