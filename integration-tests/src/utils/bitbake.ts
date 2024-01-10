/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { assertWillComeTrue } from './async'

export const BITBAKE_TIMEOUT = 300000

// TODO If bitbake-layers vscode commands are added in the future, use them instead
export async function addLayer (layer: string, workspaceFolder: string): Promise<void> {
  const bblayersConf = getBBlayersConfUri(workspaceFolder)
  const bblayersConfContent = await vscode.workspace.fs.readFile(bblayersConf)
  let fileContent = bblayersConfContent.toString()
  fileContent += `\nBBLAYERS+="${layer}"\n`
  await vscode.workspace.fs.writeFile(bblayersConf, Buffer.from(fileContent))
}

// Replace with remove-layer command if available
export async function resetLayer (layer: string, workspaceFolder: string): Promise<void> {
  const bblayersConf = getBBlayersConfUri(workspaceFolder)
  const bblayersConfContent = await vscode.workspace.fs.readFile(bblayersConf)

  // Remove last line
  const lines = bblayersConfContent.toString().split('\n')
  lines.pop()
  const fileContent = lines.join('\n')
  await vscode.workspace.fs.writeFile(bblayersConf, Buffer.from(fileContent))
}

/// Wait for the bitbake parsing task to finish
export async function awaitBitbakeParsingResult (): Promise<void> {
  let taskExecuted = false
  const disposable = vscode.tasks.onDidEndTask(async (e) => {
    if (e.execution.task.definition.options.parseOnly === true) {
      taskExecuted = true
    }
  })
  await assertWillComeTrue(async () => taskExecuted)
  disposable.dispose()
}

export async function excludeRecipes (recipes: string[], workspaceFolder: string): Promise<void> {
  const bblayersConfUri = getBBlayersConfUri(workspaceFolder)
  const bblayersConfContent = await vscode.workspace.fs.readFile(bblayersConfUri)
  let fileContent = bblayersConfContent.toString()
  for (const recipe of recipes) {
    fileContent += `\nBBMASK+="${recipe}"\n`
  }
  await vscode.workspace.fs.writeFile(bblayersConfUri, Buffer.from(fileContent))
}

export async function resetExcludedRecipes (workspaceFolder: string): Promise<void> {
  const bblayersConfUri = getBBlayersConfUri(workspaceFolder)
  const bblayersConfContent = await vscode.workspace.fs.readFile(bblayersConfUri)

  const lines = bblayersConfContent.toString().split('\n')
  const fileContentWithoutBBMASK = lines.filter((line) => (
    !line.includes('BBMASK')
  )).join('\n')
  await vscode.workspace.fs.writeFile(bblayersConfUri, Buffer.from(fileContentWithoutBBMASK))
}

function getBBlayersConfUri (workspaceFolder: string): vscode.Uri {
  const buildFolder = vscode.Uri.joinPath(vscode.Uri.file(workspaceFolder), 'build')
  return vscode.Uri.joinPath(buildFolder, 'conf/bblayers.conf')
}
