/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { onRenameRequestHandler, onPrepareRenameHandler } from '../connectionHandlers/onRename'
import { analyzer } from '../tree-sitter/analyzer'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { DUMMY_URI, FIXTURE_DOCUMENT } from './fixtures/fixtures'

describe('onRenameRequestHandler', () => {
  beforeAll(async () => {
    if (!analyzer.hasParsers()) {
      const bitBakeParser = await generateBitBakeParser()
      const bashParser = await generateBashParser()
      analyzer.initialize(bitBakeParser, bashParser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  it('should not prompt rename if it is not a symbol', () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.RENAME
    })

    const renameParams = {
      position: { line: 2, character: 1 },
      newName: 'newName',
      textDocument: { uri: DUMMY_URI }
    }

    const result = onPrepareRenameHandler(renameParams)

    expect(result).toBeNull()
  })

  it('should return expect edits', () => {
    bitBakeDocScanner.parsePythonDatastoreFunction()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.RENAME
    })

    const renameParams = {
      position: { line: 0, character: 1 },
      newName: 'newName',
      textDocument: { uri: DUMMY_URI }
    }

    const result = onRenameRequestHandler(renameParams)

    expect(result).toEqual(
      expect.objectContaining({
        changes: {
          [DUMMY_URI]: [
            {
              range: {
                start: {
                  line: 0,
                  character: 0
                },
                end: {
                  line: 0,
                  character: 3
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 1,
                  character: 7
                },
                end: {
                  line: 1,
                  character: 10
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 8,
                  character: 4
                },
                end: {
                  line: 8,
                  character: 7
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 8,
                  character: 10
                },
                end: {
                  line: 8,
                  character: 13
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 8,
                  character: 16
                },
                end: {
                  line: 8,
                  character: 19
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 4,
                  character: 14
                },
                end: {
                  line: 4,
                  character: 17
                }
              },
              newText: 'newName'
            },
            {
              range: {
                start: {
                  line: 7,
                  character: 18
                },
                end: {
                  line: 7,
                  character: 21
                }
              },
              newText: 'newName'
            }
          ]
        }
      })
    )

    // Make sure there is not additional changes
    expect(result?.changes?.[DUMMY_URI]?.length).toBe(7)
  })
})
