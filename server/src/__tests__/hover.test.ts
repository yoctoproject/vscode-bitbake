/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT, DUMMY_URI } from './fixtures/fixtures'
import { onHoverHandler } from '../connectionHandlers/onHover'
import path from 'path'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'

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

  it('should show hover definition for keywords', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 30,
        character: 1
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 31,
        character: 1
      }
    })

    const shouldShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 32,
        character: 1
      }
    })

    expect(shouldShow1).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('inherit')
        })
      })
    )

    expect(shouldShow2).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('include')
        })
      })
    )

    expect(shouldShow3).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('require')
        })
      })
    )
  })

  it('shows definition on hovering variable in Python functions for accessing datastore', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parsePythonDatastoreFunction()
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 35,
        character: 14
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 36,
        character: 14
      }
    })

    const shouldShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 40,
        character: 19
      }
    })

    const shouldShow4 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 46,
        character: 20
      }
    })

    const shouldShow5 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 44,
        character: 14
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 37,
        character: 14
      }
    })

    const shouldNotShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 38,
        character: 12
      }
    })

    const shouldNotShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 39,
        character: 19
      }
    })

    const shouldNotShow4 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 48,
        character: 10
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

    expect(shouldShow4).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldShow5).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldNotShow1).toBe(null)
    expect(shouldNotShow2).toBe(null)
    expect(shouldNotShow3).toBe(null)
    expect(shouldNotShow4).toBe(null)
  })

  it('should show comments above the global declarations', async () => {
    bitBakeDocScanner.parseYoctoTaskFile()
    bitBakeDocScanner.parseBitbakeVariablesFile()

    const parsedBarPath = path.parse(FIXTURE_DOCUMENT.BAR_INC.uri.replace('file://', ''))
    const parsedFooPath = path.parse(FIXTURE_DOCUMENT.FOO_INC.uri.replace('file://', ''))
    const parsedBazPath = path.parse(FIXTURE_DOCUMENT.BAZ_BBCLASS.uri.replace('file://', ''))

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
      _recipes: []
    }

    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DIRECTIVE
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 14,
        character: 1
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 22,
        character: 1
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 12,
        character: 1
      }
    })

    const shouldNotShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 18,
        character: 1
      }
    })

    const DUMMY_URI_TRIMMED = DUMMY_URI.replace('file://', '')

    // 1. should show all comments above the symbols that don't have docs from yocto/bitbake
    // 2. should show comments for all declarations for the same variable in the same file
    // 3. The higher priority comments replace the lower ones according to the order: .bbclass, .conf, .inc, .bb, .bbappend

    expect(shouldShow1).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining(` comment 1 for MYVAR in baz.bbclass\n\nSource: ${FIXTURE_DOCUMENT.BAZ_BBCLASS.uri.replace('file://', '')} \`L: 4\``)
        })
      })
    )

    // show comments for custom function
    expect(shouldShow2).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining(` comment 1 for my_func\n\nSource: ${DUMMY_URI_TRIMMED} \`L: 23\``)
        })
      })
    )
    // Don't show comments for variables/tasks that already have docs from yocto/bitbake

    expect(shouldNotShow1).not.toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining(`comment 1 for my_func\n\nSource: ${DUMMY_URI_TRIMMED} \`L: 23\``)
        })
      })
    )

    expect(shouldNotShow2).not.toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining(`comment 1 for do_build\n\nSource: ${DUMMY_URI_TRIMMED} \`L: 19\``)
        })
      })
    )
  })
})
