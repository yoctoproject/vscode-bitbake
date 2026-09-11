/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { initializeWorkspaceWithBitbakeSetup } from './BitbakeSetupInitialization'

export function registerBitbakeSetupCommand (
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'bitbake.initialize-workspace-with-bitbake-setup',
    async () => {
      await initializeWorkspaceWithBitbakeSetup(context)
    }
  )
}
