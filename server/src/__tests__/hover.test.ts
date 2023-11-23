/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT, DUMMY_URI } from './fixtures/fixtures'
import { onHoverHandler } from '../connectionHandlers/onHover'

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
    bitBakeDocScanner.clearScannedDocs()
  })

  it('shows definition on hovering variable in variable assignment syntax or in variable expansion syntax after scanning the docs', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 1
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 12
      }
    })

    const shouldShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 3,
        character: 9
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

    expect(shouldShow1).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldShow2).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldShow3).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldNotShow1).toBe(null)
    expect(shouldNotShow2).toBe(null)
    expect(shouldNotShow3).toBe(null)

    // With Yocto variables present, the yocto variables should be shown in case of the duplicated variable names
    bitBakeDocScanner.parseYoctoVariablesFile()

    const shouldShow4 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 1
      }
    })

    expect(shouldShow4).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n'
      }
    })
  })

  it('should show hover definition for variable flags after scanning the docs', async () => {
    bitBakeDocScanner.parseVariableFlagFile()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 12,
        character: 7
      }
    })

    const shouldNotShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 13,
        character: 9
      }
    })

    expect(shouldShow).toEqual({
      contents: {
        kind: 'markdown',
        value: '**cleandirs**\n___\n Empty directories that should be created before\n   the task runs. Directories that already exist are removed and\n   recreated to empty them.\n'
      }
    })

    expect(shouldNotShow).toBe(null)
  })

  it('should show hover definition for yocto tasks after scanning the docs', async () => {
    bitBakeDocScanner.parseYoctoTaskFile()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 15,
        character: 2
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 19,
        character: 9
      }
    })

    const shouldShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 23,
        character: 6
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 26,
        character: 5
      }
    })

    const shouldNotShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 27,
        character: 13
      }
    })

    expect(shouldShow1).toEqual({
      contents: {
        kind: 'markdown',
        value: '**do_build**\n___\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n'
      }
    })

    expect(shouldShow2).toEqual({
      contents: {
        kind: 'markdown',
        value: '**do_build**\n___\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n'
      }
    })

    expect(shouldShow3).toEqual({
      contents: {
        kind: 'markdown',
        value: '**do_build**\n___\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n'
      }
    })

    expect(shouldNotShow1).toBe(null)
    expect(shouldNotShow2).toBe(null)
  })
})
