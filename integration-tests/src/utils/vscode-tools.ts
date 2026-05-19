/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { delay } from './async'
import { languages, Location, Position, TextDocument, window, workspace, type Disposable, type LocationLink, type Uri } from 'vscode'

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

const formatDiagnosticsSnapshot = (): string => {
  const entries = languages.getDiagnostics().filter(([, diagnostics]) => diagnostics.length > 0)
  if (entries.length === 0) {
    return 'No diagnostics available.'
  }

  const maxUris = 20
  const maxDiagnosticsPerUri = 10
  const renderedEntries = entries.slice(0, maxUris).map(([uri, diagnostics]) => {
    const renderedDiagnostics = diagnostics.slice(0, maxDiagnosticsPerUri).map((diagnostic) => {
      const range = diagnostic.range
      return [
        `source=${diagnostic.source ?? '<none>'}`,
        `message=${JSON.stringify(diagnostic.message)}`,
        `range=${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
      ].join(' ')
    })

    const remainingDiagnostics = diagnostics.length - renderedDiagnostics.length
    if (remainingDiagnostics > 0) {
      renderedDiagnostics.push(`... ${remainingDiagnostics} more diagnostics`)
    }

    return `${uri.toString()}\n  ${renderedDiagnostics.join('\n  ')}`
  })

  const remainingEntries = entries.length - renderedEntries.length
  if (remainingEntries > 0) {
    renderedEntries.push(`... ${remainingEntries} more diagnostic URIs`)
  }

  return renderedEntries.join('\n')
}

export async function waitForDiagnostics (
  predicate: () => boolean,
  timeout: number = 60000,
  description: string = 'diagnostics'
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const disposables: Disposable[] = []

    const timeoutHandle = setTimeout(() => {
      finish(new Error(`Timed out waiting for ${description}\nAvailable diagnostics:\n${formatDiagnosticsSnapshot()}`))
    }, timeout)

    const finish = (error?: unknown): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeoutHandle)
      for (const disposable of disposables) {
        disposable.dispose()
      }

      if (error !== undefined) {
        reject(error)
      } else {
        resolve()
      }
    }

    const check = (): void => {
      try {
        if (predicate()) {
          finish()
        }
      } catch (error) {
        finish(error)
      }
    }

    disposables.push(languages.onDidChangeDiagnostics(check))
    check()
  })
}
