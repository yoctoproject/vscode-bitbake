/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { onReferenceHandler } from '../connectionHandlers/onReference'
import type * as LSP from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { DUMMY_URI, FIXTURE_DOCUMENT, FIXTURE_URI } from './fixtures/fixtures'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path from 'path'

describe('onReferenceHandler', () => {
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

  it('should return all possible references on a valid symbol', () => {
    const document = FIXTURE_DOCUMENT.DIRECTIVE

    const parsedBarPath = path.parse(FIXTURE_DOCUMENT.BAR_INC.uri.replace('file://', ''))
    const parsedFooPath = path.parse(FIXTURE_DOCUMENT.FOO_INC.uri.replace('file://', ''))
    const parsedBazPath = path.parse(FIXTURE_DOCUMENT.BAZ_BBCLASS.uri.replace('file://', ''))
    const parsedBitbakeConfPath = path.parse(FIXTURE_DOCUMENT.BITBAKE_CONF.uri.replace('file://', ''))

    bitBakeProjectScannerClient.bitbakeScanResult = {
      _classes: [
        {
          name: parsedBazPath.name,
          path: parsedBazPath,
          extraInfo: 'layer: core'
        }
      ],
      _includes: [
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
      ],
      _layers: [],
      _overrides: [],
      _recipes: [],
      _confFiles: [
        {
          name: parsedBitbakeConfPath.name,
          path: parsedBitbakeConfPath,
          extraInfo: 'layer: core'
        }
      ],
      _workspaces: []
    }

    analyzer.analyze({
      uri: DUMMY_URI,
      document
    })

    const referenceParams: LSP.ReferenceParams = {
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 6,
        character: 15
      },
      context: {
        includeDeclaration: true
      }
    }

    const result = onReferenceHandler(referenceParams)

    expect(result).toEqual(
      expect.arrayContaining([
        {
          uri: DUMMY_URI,
          range: {
            start: {
              line: 4,
              character: 0
            },
            end: {
              line: 4,
              character: 6
            }
          }
        },
        {
          uri: DUMMY_URI,
          range: {
            start: {
              line: 5,
              character: 0
            },
            end: {
              line: 5,
              character: 6
            }
          }
        },
        {
          uri: FIXTURE_URI.FOO_INC,
          range: {
            start: {
              line: 1,
              character: 0
            },
            end: {
              line: 1,
              character: 6
            }
          }
        },
        {
          uri: FIXTURE_URI.FOO_INC,
          range: {
            start: {
              line: 2,
              character: 0
            },
            end: {
              line: 2,
              character: 6
            }
          }
        },
        {
          uri: FIXTURE_URI.BAR_INC,
          range: {
            start: {
              line: 2,
              character: 0
            },
            end: {
              line: 2,
              character: 6
            }
          }
        },
        {
          uri: DUMMY_URI,
          range: {
            start: {
              line: 6,
              character: 9
            },
            end: {
              line: 6,
              character: 15
            }
          }
        }
      ])
    )
  })
})
