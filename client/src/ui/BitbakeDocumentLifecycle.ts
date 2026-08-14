/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { extractRecipeName } from '../lib/src/utils/files'
import { logger } from '../lib/src/utils/OutputLogger'

export function registerBitbakeDocumentLifecycle (
  bitbakeDriver: BitbakeDriver,
  bitBakeProjectScanner: BitBakeProjectScanner,
  client: LanguageClient
): vscode.Disposable[] {
  function cleanupScanResult (document: vscode.TextDocument): void {
    const ext = ['.bb', '.bbappend', '.inc']
    const { fsPath } = document.uri
    if (ext.includes(path.extname(fsPath))) {
      const recipeName = extractRecipeName(fsPath)
      const recipeFile = vscode.window.visibleTextEditors.find((editor) => {
        return ext.includes(path.extname(editor.document.uri.fsPath)) && extractRecipeName(editor.document.uri.fsPath) === recipeName
      })
      if (recipeFile === undefined) {
        logger.debug(`No files related to the recipe ${recipeName}, sending notification to remove scan results`)
        void client.sendNotification('bitbake/removeScanResult', { recipeName })
      }
    }
  }

  async function autoRecipeScan (document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'bitbake') {
      // Embedded files also trigger this event, but we don't do anything with them
      return
    }
    const parseOnSave = vscode.workspace.getConfiguration('bitbake').get('parseOnSave')
    if (parseOnSave !== true) {
      return
    }
    // Parse-on-save is automatic: skip invalid settings instead of running
    // commands that would focus the BitBake view on every save.
    if (!bitbakeDriver.isBitbakeSettingsSane() && !await bitbakeDriver.checkBitbakeSettingsSanity()) {
      return
    }
    const recipeExts = ['.bb', '.bbappend', '.inc']
    const extsForGlobalEnvScan = ['.conf', '.bbclass']
    const { fsPath } = document.uri

    if (recipeExts.includes(path.extname(fsPath))) {
      const foundRecipe = bitBakeProjectScanner.activeScanResult._recipes.find((recipe) => recipe.name === extractRecipeName(fsPath))
      if (foundRecipe !== undefined) {
        logger.debug(`[onDidSave] Running 'bitbake -e' against the saved recipe: ${foundRecipe.name}`)
        // Note that it pends only one scan at a time. See more details in the command implementation.
        // Saving more than 2 files at the same time could cause the server to miss some of the scans.
        await vscode.commands.executeCommand('bitbake.scan-recipe-env', document.uri)
        return
      }
    }

    if (extsForGlobalEnvScan.includes(path.extname(fsPath))) {
      logger.debug('[onDidSave] Running global environment scan')
      await vscode.commands.executeCommand('bitbake.scan-global-env')
      return
    }

    await vscode.commands.executeCommand('bitbake.parse-recipes')
  }

  return [
    // Check if the document that was just closed was the last one for a recipe
    vscode.workspace.onDidCloseTextDocument(cleanupScanResult),
    // Run different bitbake commands based on the saved document type
    vscode.workspace.onDidSaveTextDocument(autoRecipeScan)
  ]
}
