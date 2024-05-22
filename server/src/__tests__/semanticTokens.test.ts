/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { analyzer } from '../tree-sitter/analyzer'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { getParsedTokens, TOKEN_LEGEND } from '../semanticTokens'
import { FIXTURE_DOCUMENT, DUMMY_URI } from './fixtures/fixtures'

describe('Semantic tokens', () => {
  beforeAll(async () => {
    if (!analyzer.hasParsers()) {
      const bitBakeParser = await generateBitBakeParser()
      const bashParser = await generateBashParser()
      analyzer.initialize(bitBakeParser, bashParser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  beforeEach(() => {
    analyzer.resetAnalyzedDocuments()
  })

  it('gives approriate semantic tokens to symbols', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.SEMANTIC_TOKENS
    })

    const result = getParsedTokens(DUMMY_URI)

    expect(result).toEqual(
      [
        {
          line: 0,
          startCharacter: 0,
          length: 3,
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        },
        {
          length: 5,
          line: 2,
          startCharacter: 0,
          tokenModifiers: ['declaration'],
          tokenType: 'variable'
        },
        {
          length: 6,
          line: 2,
          startCharacter: 6,
          tokenModifiers: [],
          tokenType: 'keyword'
        },
        {
          line: 2,
          startCharacter: 13,
          length: 10,
          tokenType: TOKEN_LEGEND.types.operator,
          tokenModifiers: [TOKEN_LEGEND.modifiers.readonly]
        },
        {
          line: 2,
          startCharacter: 29,
          length: 3,
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        },
        {
          line: 4,
          startCharacter: 0,
          length: 8,
          tokenType: TOKEN_LEGEND.types.function,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        },
        {
          line: 5,
          startCharacter: 4,
          length: 3,
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: []
        },
        {
          line: 5,
          startCharacter: 10,
          length: 3,
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: []
        },
        {
          line: 5,
          startCharacter: 16,
          length: 3,
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: []
        },
        {
          line: 6,
          startCharacter: 4,
          length: 8,
          tokenType: TOKEN_LEGEND.types.function,
          tokenModifiers: []
        },
        {
          line: 9,
          startCharacter: 7,
          length: 5,
          tokenType: TOKEN_LEGEND.types.function,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        },
        {
          line: 13,
          startCharacter: 4,
          length: 6,
          tokenType: TOKEN_LEGEND.types.function,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        }
      ]
    )
  })
})
