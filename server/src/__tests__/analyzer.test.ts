/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import Analyzer from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT, DUMMY_URI, FIXTURE_URI } from './fixtures/fixtures'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path from 'path'
import fs from 'fs'
import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeSymbolInformation } from '../tree-sitter/declarations'

async function getAnalyzer (): Promise<Analyzer> {
  const bitBakeParser = await generateBitBakeParser()
  const bashParser = await generateBashParser()
  const analyzer = new Analyzer()
  analyzer.initialize(bitBakeParser, bashParser)
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
    const diagnostics = analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.CORRECT
    })
    expect(diagnostics).toEqual([])
  })

  it('analyzes the document and returns global declarations', async () => {
    const analyzer = await getAnalyzer()
    analyzer.analyze({
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
                character: 3,
                line: 1
              },
              start: {
                character: 0,
                line: 1
              }
            },
            uri: DUMMY_URI
          },
          name: 'BAR',
          overrides: ['o1', 'o2', '${PN}'],
          commentsAbove: []
        },
        {
          kind: 13,
          location: {
            range: {
              end: {
                character: 3,
                line: 0
              },
              start: {
                character: 0,
                line: 0
              }
            },
            uri: DUMMY_URI
          },
          name: 'FOO',
          overrides: [],
          commentsAbove: []
        },
        {
          kind: 12,
          location: {
            range: {
              end: {
                character: 14,
                line: 3
              },
              start: {
                character: 7,
                line: 3
              }
            },
            uri: DUMMY_URI
          },
          overrides: ['o1', 'o2'],
          name: 'my_func',
          commentsAbove: []
        }
      ])
    )
  })

  it('analyzes the document and returns word at point', async () => {
    const analyzer = await getAnalyzer()
    analyzer.analyze({
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

    const bitBakeParser = await generateBitBakeParser()
    const analyzer = await getAnalyzer()

    const parsedTree = bitBakeParser.parse(FIXTURE_DOCUMENT.DIRECTIVE.getText())
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

    analyzer.extractIncludeFileUris(uri)

    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.DIRECTIVE.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.FOO_INC.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.BAR_INC.replace('file://', ''), 'utf8')
    expect(fsReadFileSyncMock).toHaveBeenCalledWith(FIXTURE_URI.BAR_INC.replace('file://', ''), 'utf8')

    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.FOO_INC)).toBeDefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAR_INC)).toBeDefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAZ_BBCLASS)).toBeDefined()
  })

  it('does not read the files and parse the syntax tree when the documents were already analyzed ', async () => {
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.DIRECTIVE
    // analyze 4 documents before calling sourceIncludeFiles
    analyzer.analyze({ document: FIXTURE_DOCUMENT.DIRECTIVE, uri: FIXTURE_URI.DIRECTIVE })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.BAR_INC, uri: FIXTURE_URI.BAR_INC })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.FOO_INC, uri: FIXTURE_URI.FOO_INC })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.BAZ_BBCLASS, uri: FIXTURE_URI.BAZ_BBCLASS })

    jest.spyOn(Analyzer.prototype, 'getDirectiveFileUris').mockReturnValueOnce([
      FIXTURE_URI.BAR_INC,
      FIXTURE_URI.FOO_INC,
      FIXTURE_URI.BAZ_BBCLASS
    ])

    const loggerMock = jest.spyOn(logger, 'debug')

    analyzer.extractIncludeFileUris(uri)

    let loggerDebugCalledTimes = 0
    loggerMock.mock.calls.forEach((call) => {
      if (call[0].includes('[Analyzer] File already analyzed')) {
        loggerDebugCalledTimes++
      }
    })

    // All 4 files were analyzed before, so the logger should be called 4 times
    expect(loggerDebugCalledTimes).toEqual(4)

    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.FOO_INC)).toBeDefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAR_INC)).toBeDefined()
    expect(analyzer.getAnalyzedDocument(FIXTURE_URI.BAZ_BBCLASS)).toBeDefined()
  })

  it('gets symbols from the include files', async () => {
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.DIRECTIVE

    analyzer.analyze({ document: FIXTURE_DOCUMENT.DIRECTIVE, uri: FIXTURE_URI.DIRECTIVE })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.BAR_INC, uri: FIXTURE_URI.BAR_INC })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.FOO_INC, uri: FIXTURE_URI.FOO_INC })
    analyzer.analyze({ document: FIXTURE_DOCUMENT.BAZ_BBCLASS, uri: FIXTURE_URI.BAZ_BBCLASS })

    jest.spyOn(Analyzer.prototype, 'getDirectiveFileUris').mockReturnValueOnce([
      FIXTURE_URI.BAR_INC,
      FIXTURE_URI.FOO_INC,
      FIXTURE_URI.BAZ_BBCLASS
    ])

    analyzer.extractIncludeFileUris(uri)

    const symbols = analyzer.getIncludeUrisForUri(uri).map((includeUri) => {
      return analyzer.getGlobalDeclarationSymbols(includeUri)
    }).flat()

    expect(symbols).toEqual(
      expect.arrayContaining([
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
                character: 11
              }
            }
          }
        }),
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
                character: 11
              }
            }
          }
        }),
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
                character: 11
              }
            }
          }
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

    analyzer.analyze({
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
  it('returns an array of links in the string content when variable is SRC_URI', async () => {
    const analyzer = await getAnalyzer()
    const document = FIXTURE_DOCUMENT.CORRECT
    const uri = FIXTURE_URI.CORRECT

    analyzer.analyze({
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

    analyzer.analyze({
      document,
      uri
    })

    // Mock the getAnalyzedDocument method to return undefined
    analyzer.getAnalyzedDocument = jest.fn().mockReturnValue(undefined)

    const links = analyzer.getLinksInStringContent(uri)

    expect(links).toEqual([])
  })
})

describe('getVariableExpansionSymbols', () => {
  it('returns an array of BitbakeSymbolInformation for variable expansions', async () => {
    const analyzer = await getAnalyzer()
    const document = FIXTURE_DOCUMENT.HOVER
    const uri = FIXTURE_URI.HOVER

    analyzer.analyze({
      document,
      uri
    })

    const bitBakeTree = analyzer.getAnalyzedDocument(uri)?.bitBakeTree

    if (bitBakeTree === undefined) {
      fail('Tree is undefined')
    }

    const symbols = analyzer.getSymbolsFromBitBakeTree({ bitBakeTree, uri }).variableExpansionSymbols

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'DESCRIPTION',
          location: expect.objectContaining({
            range: { start: { line: 2, character: 11 }, end: { line: 2, character: 22 } }
          })
        }),
        expect.objectContaining({
          name: 'DESCRIPTION',
          location: expect.objectContaining({
            range: { start: { line: 3, character: 8 }, end: { line: 3, character: 19 } }
          })
        })
      ])
    )
  })
})

describe('resolveSymbol', () => {
  it('resolves symbols with variable expansion syntax', async () => {
    /**
     * Resolve the overrides first, then the symbol
     * VAR:${PN} = "foo"
     * if PN = "1", resolved symbol -> VAR:1 = "foo"
     */
    const analyzer = await getAnalyzer()
    const uri = FIXTURE_URI.HOVER

    const PN = '1'
    const PV = '1.0+git'

    const symbol1: BitbakeSymbolInformation = {
      name: 'symbol1',
      location: {
        uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 }
        }
      },
      kind: 13,
      commentsAbove: [],
      overrides: ['override1', 'override2', '${PN}', '${PN}-foo']
    }

    const symbol2: BitbakeSymbolInformation = {
      ...symbol1,
      overrides: []
    }

    const symbol3 = 'recipe_${PV}.bb'

    const lookUpSymbolList: BitbakeSymbolInformation[] = [
      {
        name: 'PN',
        location: {
          uri,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          }
        },
        kind: 13,
        commentsAbove: [],
        overrides: [],
        finalValue: PN
      },
      {
        name: 'PV',
        location: {
          uri,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          }
        },
        kind: 13,
        commentsAbove: [],
        overrides: [],
        finalValue: PV
      },
      {
        name: 'symbol1',
        location: {
          uri,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          }
        },
        kind: 13,
        commentsAbove: [],
        overrides: ['override1', 'override2', PN, PN + '-foo']
      }
    ]

    const resolvedSymbol1 = analyzer.resolveSymbol(symbol1, lookUpSymbolList)
    const resolvedSymbol2 = analyzer.resolveSymbol(symbol2, lookUpSymbolList)
    const resolvedSymbol3 = analyzer.resolveSymbol(symbol3, lookUpSymbolList)

    expect(resolvedSymbol1).toEqual(lookUpSymbolList[2])
    expect(resolvedSymbol2).toEqual(symbol2) // not found in the look up list, resolve to itself
    expect(resolvedSymbol3).toEqual('recipe_1.0.bb')
  })
})
