/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { assertWillComeTrue, delay } from './async'
import { extensions, Location, Position, Range, TextDocument, window, workspace, type LocationLink, type Uri } from 'vscode'

export const getDefinitionUri = (definition: Location | LocationLink): Uri => {
  if (definition instanceof Location) {
    return definition.uri
  }
  return definition.targetUri
}

/// Ensure embedded language extensions (bash, python) are activated.
/// In headless mode, these extensions may take longer to activate and respond.
export async function ensureLanguageServersReady (): Promise<void> {
  const bashExt = extensions.getExtension('mads-hartmann.bash-ide-vscode')
  const pythonExt = extensions.getExtension('ms-python.python')
  const pylanceExt = extensions.getExtension('ms-python.vscode-pylance')

  if (bashExt && !bashExt.isActive) {
    await bashExt.activate()
  }
  if (pythonExt && !pythonExt.isActive) {
    await pythonExt.activate()
  }
  if (pylanceExt && !pylanceExt.isActive) {
    await pylanceExt.activate()
  }

  // Give extensions time to initialize their language clients in headless mode
  // Pylance especially needs significant time to initialize and prepare analyzers
  await delay(5000)
}

/// Work around headless VS Code not always firing the expected document-open analysis flow.
/// We force a real in-memory edit cycle without saving to avoid triggering parse-on-save races.
export async function forceDocumentAnalysis (docUri: Uri): Promise<TextDocument> {
  const doc = await workspace.openTextDocument(docUri)
  const editor = await window.showTextDocument(doc)
  const lastLineLength = doc.lineAt(doc.lineCount - 1).text.length
  const lastLinePos = new Position(doc.lineCount - 1, lastLineLength)

  // Give VS Code time to attach providers before nudging the document.
  await delay(1000)
  await editor.edit(edit => {
    edit.insert(lastLinePos, ' ')
  })
  await editor.edit(edit => {
    edit.delete(new Range(lastLinePos, new Position(lastLinePos.line, lastLinePos.character + 1)))
  })

  // Wait for embedded documents (Python, Bash) to be regenerated from the text change.
  await delay(2000)
  return await workspace.openTextDocument(docUri)
}

export async function warmEmbeddedDocument (languageId: string, expectedText: string): Promise<TextDocument> {
  let embeddedDocument: TextDocument | undefined

  console.log(`[warmEmbeddedDocument] Looking for ${languageId} document containing "${expectedText}"`)

  await assertWillComeTrue(async () => {
    embeddedDocument = workspace.textDocuments.find((document) => {
      return document.uri.fsPath.includes('embedded-documents') &&
        document.languageId === languageId &&
        document.getText().includes(expectedText)
    })
    if (embeddedDocument) {
      console.log(`[warmEmbeddedDocument] Found embedded document: ${embeddedDocument.uri.fsPath}`)
    }
    return embeddedDocument !== undefined
  }, 500, 10000)

  if (embeddedDocument === undefined) {
    throw new Error(`Unable to find embedded ${languageId} document containing "${expectedText}"`)
  }

  console.log(`[warmEmbeddedDocument] Showing embedded document for Pylance analysis...`)
  await window.showTextDocument(embeddedDocument, { preview: false })

  // Wait for Pylance to analyze the document - needs time to initialize
  console.log(`[warmEmbeddedDocument] Waiting 3000ms for Pylance to analyze document...`)
  await delay(3000)

  console.log(`[warmEmbeddedDocument] Document shown and analyzed, returning`)
  return embeddedDocument
}
