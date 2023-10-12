/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */


import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import { ClientNotificationManager } from './ui/ClientNotificationManager'
import { logger } from './ui/OutputLogger';
import { activateLanguageServer, deactivateLanguageServer } from './language/languageClient';

let client: LanguageClient

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  client = await activateLanguageServer(context)

  const notificationManager = new ClientNotificationManager(client, context.globalState)
  context.subscriptions.push(...notificationManager.buildHandlers())

  // Handle settings change for bitbake driver
  context.subscriptions.push(workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('bitbake.loggingLevel')) {
      logger.loadSettings()
    }
  }))

  logger.info('Congratulations, your extension "BitBake" is now active!')
}

export function deactivate (): Thenable<void> | undefined {
  return deactivateLanguageServer(client)
}
