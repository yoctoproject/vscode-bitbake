/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { bitBakeDocScanner, type VariableInfos } from '../BitBakeDocScanner'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { onHoverHandler } from '../connectionHandlers/onHover'
const DUMMY_URI = 'dummy_uri'
const mockedVariableInfos: Record<string, VariableInfos> = {
  DESCRIPTION: {
    name: 'DESCRIPTION',
    definition: 'A long description for the recipe.'
  },
  B: {
    name: 'B',
    definition: 'The directory in which BitBake executes functions during a recipe’s build process.'
  }
}

jest.spyOn(bitBakeDocScanner, 'variablesInfos', 'get').mockReturnValue(mockedVariableInfos)

describe('on hover', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  beforeEach(() => {
    analyzer.resetAnalyzedDocuments()
  })

  it('only shows definition on hovering global variable declaration syntax for bitbake variables', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 1
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 4,
        character: 8
      }
    })

    const shouldNotShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 8,
        character: 47
      }
    })

    const shouldNotShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 10,
        character: 3
      }
    })

    expect(shouldShow).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\nA long description for the recipe.'
      }
    })

    expect(shouldNotShow1).toBe(null)
    expect(shouldNotShow2).toBe(null)
    expect(shouldNotShow3).toBe(null)
  })
})
