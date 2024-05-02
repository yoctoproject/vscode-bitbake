/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as LSP from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'

export function onRenameRequestHandler (renameParams: LSP.RenameParams): LSP.WorkspaceEdit | undefined | null {
  const { position, newName, textDocument: { uri } } = renameParams
  const word = analyzer.wordAtPoint(uri, position.line, position.character)

  if (word === null) {
    return null
  }

  const exactSymbol = analyzer.findExactSymbolAtPoint(uri, position, word)

  if (exactSymbol === undefined) {
    return null
  }

  const allSymbols = [
    ...analyzer.getGlobalDeclarationSymbols(uri).filter(symbol => symbol.name === word && symbol.kind === exactSymbol.kind),
    ...analyzer.getVariableExpansionSymbols(uri).filter(symbol => symbol.name === word && symbol.kind === exactSymbol.kind)
  ]

  const edits = {
    changes: {
      [uri]: allSymbols.map((symbol) => {
        return {
          range: symbol.location.range,
          newText: newName
        }
      })
    }
  }

  return edits
}

export function onPrepareRenameHandler (onPrepareRenameParams: LSP.PrepareRenameParams): LSP.PrepareRenameResult | undefined | null {
  const { textDocument: { uri }, position } = onPrepareRenameParams
  const word = analyzer.wordAtPoint(uri, position.line, position.character)

  if (word === null) {
    return null
  }

  const exactSymbol = analyzer.findExactSymbolAtPoint(uri, position, word)

  if (exactSymbol === undefined) {
    return null
  }

  return {
    range: exactSymbol.location.range,
    placeholder: exactSymbol.name
  }
}
