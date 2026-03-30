/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { analyzer } from '../tree-sitter/analyzer'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { getParsedTokens, TOKEN_LEGEND } from '../semanticTokens'
import { FIXTURE_DOCUMENT, DUMMY_URI } from './fixtures/fixtures'
import { TextDocument } from 'vscode-languageserver-textdocument'

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

  it('gives variable and override tokens to OVERRIDES statement (issue #353 case 1)', async () => {
    // OVERRIDES = "linux:arm:pn-foo" is parsed by tree-sitter-bitbake as an
    // overrides_statement. The OVERRIDES keyword itself has node type 'OVERRIDES'
    // (not 'identifier'), and the override names are identifiers whose parent
    // is 'overrides_statement' rather than 'override'.
    const content = 'OVERRIDES = "linux:arm:pn-foo"'
    analyzer.analyze({
      uri: DUMMY_URI,
      document: TextDocument.create(DUMMY_URI, 'bitbake', 0, content)
    })

    const result = getParsedTokens(DUMMY_URI)

    // OVERRIDES keyword → variable + declaration
    expect(result).toEqual(
      expect.arrayContaining([
        {
          line: 0,
          startCharacter: 0,
          length: 9, // 'OVERRIDES'
          tokenType: TOKEN_LEGEND.types.variable,
          tokenModifiers: [TOKEN_LEGEND.modifiers.declaration]
        }
      ])
    )

    // 'linux' → operator + readonly (override name)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          line: 0,
          startCharacter: 13,
          length: 5, // 'linux'
          tokenType: TOKEN_LEGEND.types.operator,
          tokenModifiers: [TOKEN_LEGEND.modifiers.readonly]
        }
      ])
    )

    // 'arm' → operator + readonly
    expect(result).toEqual(
      expect.arrayContaining([
        {
          line: 0,
          startCharacter: 19,
          length: 3, // 'arm'
          tokenType: TOKEN_LEGEND.types.operator,
          tokenModifiers: [TOKEN_LEGEND.modifiers.readonly]
        }
      ])
    )

    // 'pn-foo' → operator + readonly
    expect(result).toEqual(
      expect.arrayContaining([
        {
          line: 0,
          startCharacter: 23,
          length: 6, // 'pn-foo'
          tokenType: TOKEN_LEGEND.types.operator,
          tokenModifiers: [TOKEN_LEGEND.modifiers.readonly]
        }
      ])
    )
  })

  it('gives keyword tokens to bash control-flow keywords inside shell functions (issue #353 case 3)', async () => {
    // Bash keywords such as 'then', 'if', 'fi' have node types matching their
    // text in tree-sitter-bash. They should receive a keyword semantic token
    // so they are highlighted inside BitBake shell functions.
    const content = [
      'do_install () {',
      '    if [ -f "${D}/file" ]; then',
      '        echo "found"',
      '    fi',
      '}'
    ].join('\n')

    analyzer.analyze({
      uri: DUMMY_URI,
      document: TextDocument.create(DUMMY_URI, 'bitbake', 0, content)
    })

    const result = getParsedTokens(DUMMY_URI)
    const keywordTokens = result.filter((t) => t.tokenType === TOKEN_LEGEND.types.keyword)

    // 'if', 'then', 'fi' should all appear as keyword tokens
    const labels = keywordTokens.map((t) => content.split('\n')[t.line].substring(t.startCharacter, t.startCharacter + t.length))
    expect(labels).toContain('if')
    expect(labels).toContain('then')
    expect(labels).toContain('fi')
  })
})
