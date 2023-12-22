/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { generateParser } from '../tree-sitter/parser'
import Analyzer from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT, DUMMY_URI, FIXTURE_URI } from './fixtures/fixtures'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path from 'path'
import fs from 'fs'
import { logger } from '../lib/src/utils/OutputLogger'
import { type GlobalDeclarations } from '../tree-sitter/declarations'

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

    expect(globalDeclarations).toEqual(
      expect.arrayContaining([
        {
          kind: 13,
          location: {
            range: {
              end: {
                character: 11,
                line: 1
              },
              start: {
                character: 0,
                line: 1
              }
            },
            uri: DUMMY_URI
          },
          name: 'BAR'
        },
        {
          kind: 13,
          location: {
            range: {
              end: {
                character: 11,
                line: 0
              },
              start: {
                character: 0,
                line: 0
              }
            },
            uri: DUMMY_URI
          },
          name: 'FOO'
        }
      ])
    )
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

describe('getDirectiveFileUris', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gets directive file URIs', async () => {
    const parsedBarPath = path.parse(FIXTURE_DOCUMENT.BAR_INC.uri.replace('file://', ''))
    const parsedFooPath = path.parse(FIXTURE_DOCUMENT.FOO_INC.uri.replace('file://', ''))
    const parsedBazPath = path.parse(FIXTURE_DOCUMENT.BAZ_BBCLASS.uri.replace('file://', ''))

    bitBakeProjectScannerClient.bitbakeScanResult._includes = [
      {
        name: parsedBarPath.name,
        path: parsedBarPath,
        extraInfo: 'layer: core'
      },
      {
        name: parsedFooPath.name,
        path: parsedFooPath,
        extraInfo: 'layer: core'
      }
    ]

    bitBakeProjectScannerClient.bitbakeScanResult._classes = [{
      name: parsedBazPath.name,
      path: parsedBazPath,
      extraInfo: 'layer: core'
    }]

    const parser = await generateParser()
    const analyzer = await getAnalyzer()

    const parsedTree = parser.parse(FIXTURE_DOCUMENT.DIRECTIVE.getText())
    const fileUris = analyzer.getDirectiveFileUris(parsedTree)

    expect(fileUris).toEqual(
      expect.arrayContaining([
        FIXTURE_URI.BAR_INC,
        FIXTURE_URI.FOO_INC,
        FIXTURE_URI.BAZ_BBCLASS
      ])
    )
  })
})
describe('sourceIncludeFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finds and analyzes files in the directive statements for the first time', async () => {
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.DIRECTIVE

    jest.spyOn(Analyzer.prototype, 'getDirectiveFileUris').mockReturnValueOnce([
      FIXTURE_URI.BAR_INC,
      FIXTURE_URI.FOO_INC,
      FIXTURE_URI.BAZ_BBCLASS
    ])

    const fsReadFileSyncMock = jest.spyOn(fs, 'readFileSync')

    analyzer.sourceIncludeFiles(uri, [], [])

    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.DIRECTIVE.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.FOO_INC.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.BAR_INC.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.BAR_INC.replace('file://', ''), 'utf8')

    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.FOO_INC)).not.toBeUndefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAR_INC)).not.toBeUndefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAZ_BBCLASS)).not.toBeUndefined()
  })

  it('does not read the files and parse the syntax tree when the documents were already analyzed ', async () => {
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.DIRECTIVE
    // analyze 4 documents before calling sourceIncludeFiles
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.DIRECTIVE, uri: FIXTURE_URI.DIRECTIVE })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.BAR_INC, uri: FIXTURE_URI.BAR_INC })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.FOO_INC, uri: FIXTURE_URI.FOO_INC })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.BAZ_BBCLASS, uri: FIXTURE_URI.BAZ_BBCLASS })

    jest.spyOn(Analyzer.prototype, 'getDirectiveFileUris').mockReturnValueOnce([
      FIXTURE_URI.BAR_INC,
      FIXTURE_URI.FOO_INC,
      FIXTURE_URI.BAZ_BBCLASS
    ])

    const loggerMock = jest.spyOn(logger, 'debug')

    analyzer.sourceIncludeFiles(uri, [], [])

    let loggerDebugCalledTimes = 0
    loggerMock.mock.calls.forEach((call) => {
      if (call[0].includes('[Analyzer] File already analyzed')) {
        loggerDebugCalledTimes++
      }
    })

    // All 4 files were analyzed before, so the logger should be called 4 times
    expect(loggerDebugCalledTimes).toEqual(4)

    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.FOO_INC)).not.toBeUndefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAR_INC)).not.toBeUndefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAZ_BBCLASS)).not.toBeUndefined()
  })

  it('gets symbols from the include files', async () => {
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.DIRECTIVE

    await analyzer.analyze({ document: FIXTURE_DOCUMENT.DIRECTIVE, uri: FIXTURE_URI.DIRECTIVE })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.BAR_INC, uri: FIXTURE_URI.BAR_INC })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.FOO_INC, uri: FIXTURE_URI.FOO_INC })
    await analyzer.analyze({ document: FIXTURE_DOCUMENT.BAZ_BBCLASS, uri: FIXTURE_URI.BAZ_BBCLASS })

    jest.spyOn(Analyzer.prototype, 'getDirectiveFileUris').mockReturnValueOnce([
      FIXTURE_URI.BAR_INC,
      FIXTURE_URI.FOO_INC,
      FIXTURE_URI.BAZ_BBCLASS
    ])

    /* eslint-disable-next-line prefer-const */
    let symbols: GlobalDeclarations[] = []
    analyzer.sourceIncludeFiles(uri, symbols, [])

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          DESCRIPTION: expect.arrayContaining([
            expect.objectContaining({
              name: 'DESCRIPTION',
              location: {
                uri: FIXTURE_URI.BAR_INC,
                range: {
                  start: {
                    line: 0,
                    character: 0
                  },
                  end: {
                    line: 0,
                    character: 23
                  }
                }
              }
            })
          ])
        })
      ])
    )

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          DESCRIPTION: expect.arrayContaining([
            expect.objectContaining({
              name: 'DESCRIPTION',
              location: {
                uri: FIXTURE_URI.FOO_INC,
                range: {
                  start: {
                    line: 0,
                    character: 0
                  },
                  end: {
                    line: 0,
                    character: 23
                  }
                }
              }
            })
          ])
        })
      ])
    )

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          DESCRIPTION: expect.arrayContaining([
            expect.objectContaining({
              name: 'DESCRIPTION',
              location: {
                uri: FIXTURE_URI.BAZ_BBCLASS,
                range: {
                  start: {
                    line: 0,
                    character: 0
                  },
                  end: {
                    line: 0,
                    character: 27
                  }
                }
              }
            })
          ])
        })
      ])
    )
  })
})

describe('declarations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gets all symbols in the declaration statements with duplicates', async () => {
    const analyzer = await getAnalyzer()
    const document = FIXTURE_DOCUMENT.COMPLETION
    const uri = FIXTURE_URI.COMPLETION

    await analyzer.analyze({
      document,
      uri
    })

    const symbols = analyzer.getGlobalDeclarationSymbols(uri)

    let occurances = 0
    symbols.forEach((symbol) => {
      if (symbol.name === 'MYVAR') {
        occurances++
      }
    })

    expect(occurances).toEqual(5)
  })
})

describe('getLinksInStringContent', () => {
  it('returns an array of links in the string content', async () => {
    const analyzer = await getAnalyzer()
    const document = FIXTURE_DOCUMENT.CORRECT
    const uri = FIXTURE_URI.CORRECT

    await analyzer.analyze({
      document,
      uri
    })

    const expectedLinks = [
      {
        value: 'foo.inc',
        range: {
          start: { line: 6, character: 11 },
          end: { line: 6, character: 25 }
        }
      }
    ]

    const links = analyzer.getLinksInStringContent(uri)

    expect(links).toEqual(expectedLinks)
  })

  it('returns an empty array if the parsed tree is undefined', async () => {
    const analyzer = await getAnalyzer()
    const document = FIXTURE_DOCUMENT.CORRECT
    const uri = FIXTURE_URI.CORRECT

    await analyzer.analyze({
      document,
      uri
    })

    // Mock the getAnalyzedDocument method to return undefined
    analyzer.getAnalyzedDocument = jest.fn().mockReturnValue(undefined)

    const links = analyzer.getLinksInStringContent(uri)

    expect(links).toEqual([])
  })
})
