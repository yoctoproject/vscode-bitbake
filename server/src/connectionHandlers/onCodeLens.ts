/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as LSP from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'

export async function onCodeLensHandler (params: LSP.CodeLensParams, enableCodeLensReferencesOnFunctions: boolean): Promise<LSP.CodeLens[]> {
  const codeLenses: LSP.CodeLens[] = []
  const uri = params.textDocument.uri

  if (!enableCodeLensReferencesOnFunctions) {
    return []
  }

  const allSymbols = analyzer.getGlobalDeclarationSymbolsForUri(uri)
  allSymbols.forEach((symbol) => {
    if (symbol.kind === LSP.SymbolKind.Function) {
      const codeLens = LSP.CodeLens.create(symbol.location.range)

      codeLens.command = {
        title: 'Show References',
        command: 'bitbake.codeLens.showReferences',
        arguments: [uri, symbol.location.range.start]
      }

      codeLens.data = { uri, position: symbol.location.range.start }

      codeLenses.push(codeLens)
    }
  })
  return codeLenses
}

export function onCodeLensResolveHandler (codeLens: LSP.CodeLens): LSP.CodeLens {
  return codeLens
}
