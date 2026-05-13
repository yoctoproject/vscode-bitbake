/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { delay } from './async'
import { Location, Position, TextDocument, window, workspace, type LocationLink, type Uri } from 'vscode'

export const getDefinitionUri = (definition: Location | LocationLink): Uri => {
  if (definition instanceof Location) {
    return definition.uri
  }
  return definition.targetUri
}

/// Work around headless VS Code not always firing the expected document-open analysis flow.
/// We force a real edit, save it, wait for the analyzers to react, then undo the change.
export async function forceDocumentAnalysis (docUri: Uri): Promise<TextDocument> {
  const doc = await workspace.openTextDocument(docUri)
  const editor = await window.showTextDocument(doc)
  const lastLineLength = doc.lineAt(doc.lineCount - 1).text.length
  const lastLinePos = new Position(doc.lineCount - 1, lastLineLength)

  await delay(3000)
  await editor.edit(edit => {
    edit.insert(lastLinePos, '\n')
  })
  await doc.save()
  await delay(1500)
  return doc
}
