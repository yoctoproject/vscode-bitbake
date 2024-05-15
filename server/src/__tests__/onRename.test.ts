/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { onRenameRequestHandler, onPrepareRenameHandler } from '../connectionHandlers/onRename'
import { analyzer } from '../tree-sitter/analyzer'
import { generateBitBakeParser } from '../tree-sitter/parser'
import { DUMMY_URI, FIXTURE_DOCUMENT } from './fixtures/fixtures'

describe('onRenameRequestHandler', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const bitBakeParser = await generateBitBakeParser()
      analyzer.initialize(bitBakeParser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  it('should not prompt rename if it is not a symbol', () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const renameParams = {
      position: { line: 1, character: 17 },
      newName: 'newName',
      textDocument: { uri: DUMMY_URI }
    }

    const result = onPrepareRenameHandler(renameParams)

    expect(result).toBeNull()
  })

  it('should return expect edits', () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const renameParams = {
      position: { line: 2, character: 1 },
      newName: 'newName',
      textDocument: { uri: DUMMY_URI }
    }

    const result = onRenameRequestHandler(renameParams)

    expect(result).toEqual(
      expect.objectContaining({
        changes: {
          [DUMMY_URI]: expect.arrayContaining([
            {
              range: {
                start: { line: 2, character: 0 },
                end: { line: 2, character: 5 }
              },
              newText: 'newName'
            },
            {
              range: {
                start: { line: 3, character: 0 },
                end: { line: 3, character: 5 }
              },
              newText: 'newName'
            }
          ])
        }
      })
    )
  })
})
