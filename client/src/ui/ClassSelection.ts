/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import * as vscode from 'vscode'

import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { sanitizeForShell } from '../lib/src/BitbakeSettings'
import { BitbakeClassTreeItem } from './BitbakeClassesView'
import { type BitbakeWorkspace } from './BitbakeWorkspace'

export async function addActiveClass (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  bitbakeClass?: string
): Promise<string | undefined> {
  if (typeof bitbakeClass === 'string') {
    await bitbakeWorkspace.addActiveClass(bitbakeClass)
    return bitbakeClass
  }

  const activeClasses = new Set(bitbakeWorkspace.activeClasses)
  const classNames = [...new Set(bitBakeProjectScanner.activeScanResult._classes.map((classInfo) => classInfo.name))]
    .filter((className) => !activeClasses.has(className))

  let chosenClass: string | undefined
  if (classNames.length !== 0) {
    chosenClass = await vscode.window.showQuickPick(
      classNames,
      { placeHolder: 'Select class to add' }
    )
  } else {
    chosenClass = await vscode.window.showInputBox({
      placeHolder: "Type the class name to add. (Bitbake scan not complete yet)"
    })
  }

  if (chosenClass !== undefined) {
    chosenClass = sanitizeForShell(chosenClass) as string
    await bitbakeWorkspace.addActiveClass(chosenClass)
  }

  return chosenClass
}

export async function selectClass (
  bitbakeWorkspace: BitbakeWorkspace,
  bitBakeProjectScanner: BitBakeProjectScanner,
  uri?: unknown,
  canAdd: boolean = true
): Promise<string | undefined> {
  let chosenClass: string | undefined

  if (typeof uri === 'string') {
    return uri
  }

  if (uri instanceof BitbakeClassTreeItem) {
    return uri.label
  }

  if (uri instanceof vscode.Uri && path.extname(uri.fsPath) === '.bbclass') {
    chosenClass = path.parse(uri.fsPath).name
    if (canAdd) await bitbakeWorkspace.addActiveClass(chosenClass)
  }

  if (chosenClass === undefined) {
    const quickPickItems = [...bitbakeWorkspace.activeClasses]

    if (canAdd || bitbakeWorkspace.activeClasses.length === 0) {
      quickPickItems.push('Add another class...')
    }

    chosenClass = await vscode.window.showQuickPick(
      quickPickItems,
      { placeHolder: 'Select bitbake class' }
    )

    if (chosenClass === 'Add another class...') {
      chosenClass = await addActiveClass(bitbakeWorkspace, bitBakeProjectScanner)
    }
  }

  return chosenClass
}
