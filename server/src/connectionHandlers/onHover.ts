/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverParams, type Hover } from 'vscode-languageserver'
import { analyzer } from '../tree-sitter/analyzer'
import { bitBakeDocScanner } from '../BitBakeDocScanner'

export async function onHoverHandler (params: HoverParams): Promise<Hover | undefined> {
  const { position, textDocument } = params
  const documentAsText = analyzer.getDocumentTexts(textDocument.uri)
  const textLine = documentAsText?.[position.line]
  if (textLine === undefined) {
    return undefined
  }
  const matches = textLine.matchAll(bitBakeDocScanner.variablesRegex)
  for (const match of matches) {
    const name = match[1].toUpperCase()
    if (name === undefined || match.index === undefined) {
      continue
    }
    const start = match.index
    const end = start + name.length
    if ((start > position.character) || (end <= position.character)) {
      continue
    }

    const definition = bitBakeDocScanner.variablesInfos[name]?.definition
    const hover: Hover = {
      contents: {
        kind: 'markdown',
        value: `**${name}**\n___\n${definition}`
      },
      range: {
        start: position,
        end: {
          ...position,
          character: end
        }
      }
    }
    return hover
  }
}
