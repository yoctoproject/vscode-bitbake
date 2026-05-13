/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { assertWillComeTrue, delay } from './async'
import { Location, Position, Range, TextDocument, window, workspace, type LocationLink, type Uri } from 'vscode'

export const getDefinitionUri = (definition: Location | LocationLink): Uri => {
  if (definition instanceof Location) {
    return definition.uri
  }
  return definition.targetUri
}

/// Work around headless VS Code not always firing the expected document-open analysis flow.
/// We force a real in-memory edit cycle without saving to avoid triggering parse-on-save races.
export async function forceDocumentAnalysis (docUri: Uri): Promise<TextDocument> {
  const doc = await workspace.openTextDocument(docUri)
  const editor = await window.showTextDocument(doc)
  const lastLineLength = doc.lineAt(doc.lineCount - 1).text.length
  const lastLinePos = new Position(doc.lineCount - 1, lastLineLength)

  await delay(1000)
  await editor.edit(edit => {
    edit.insert(lastLinePos, ' ')
  })
  await editor.edit(edit => {
    edit.delete(new Range(lastLinePos, new Position(lastLinePos.line, lastLinePos.character + 1)))
  })
  await delay(2000)
  return await workspace.openTextDocument(docUri)
}

export async function warmEmbeddedDocument (
  languageId: string,
  expectedText: string
): Promise<TextDocument> {
  let embeddedDocument: TextDocument | undefined

  await assertWillComeTrue(async () => {
    embeddedDocument = workspace.textDocuments.find((document) =>
      document.uri.fsPath.includes('embedded-documents') &&
      document.languageId === languageId &&
      document.getText().includes(expectedText)
    )
    return embeddedDocument !== undefined
  }, 500, 10000)

  if (embeddedDocument === undefined) {
    throw new Error(`Unable to find embedded ${languageId} document containing "${expectedText}"`)
  }

  await window.showTextDocument(embeddedDocument, { preview: false })
  await delay(3000)

  return embeddedDocument
}
