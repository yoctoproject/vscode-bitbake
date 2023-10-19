/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { generateParser } from '../tree-sitter/parser'
import Analyzer from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'

// Needed as the param
const DUMMY_URI = 'dummy_uri'

async function getAnalyzer (): Promise<Analyzer> {
  const parser = await generateParser()
  const analyzer = new Analyzer()
  analyzer.initialize(parser)
  return analyzer
}

const initialize = jest.spyOn(Analyzer.prototype, 'initialize')
const wordAtPoint = jest.spyOn(Analyzer.prototype, 'wordAtPoint')

describe('analyze', () => {
  it('instantiates an analyzer', async () => {
    // Alternative: Spy on something (logger) within the analyzer instead of spying on every function in the Analyzer
    await getAnalyzer()

    expect(initialize).toHaveBeenCalled()
  })

  it('analyzes simple correct bb file', async () => {
    const analyzer = await getAnalyzer()
    const diagnostics = await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.CORRECT
    })
    expect(diagnostics).toEqual([])
  })

  it('analyzes the document and returns global declarations', async () => {
    const analyzer = await getAnalyzer()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DECLARATION
    })

    const globalDeclarations = analyzer.getGlobalDeclarationSymbols(DUMMY_URI)

    expect(globalDeclarations).toMatchInlineSnapshot(`
      [
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 11,
                "line": 0,
              },
              "start": {
                "character": 0,
                "line": 0,
              },
            },
            "uri": "${DUMMY_URI}",
          },
          "name": "FOO",
        },
        {
          "kind": 13,
          "location": {
            "range": {
              "end": {
                "character": 11,
                "line": 1,
              },
              "start": {
                "character": 0,
                "line": 1,
              },
            },
            "uri": "${DUMMY_URI}",
          },
          "name": "BAR",
        },
      ]
    `)
  })

  it('analyzes the document and returns word at point', async () => {
    const analyzer = await getAnalyzer()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DECLARATION
    })

    const word1 = analyzer.wordAtPoint(
      DUMMY_URI,
      0,
      0
    )
    const word2 = analyzer.wordAtPoint(
      DUMMY_URI,
      1,
      0
    )

    expect(wordAtPoint).toHaveBeenCalled()
    expect(word1).toEqual('FOO')
    expect(word2).toEqual('BAR')
  })
})
