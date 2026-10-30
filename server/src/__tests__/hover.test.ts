/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { analyzer } from '../tree-sitter/analyzer'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT, DUMMY_URI } from './fixtures/fixtures'
import { onHoverHandler } from '../connectionHandlers/onHover'
import path from 'path'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import { extractRecipeName } from '../lib/src/utils/files'
import { BitbakeScanResult } from '../lib/src/types/BitbakeScanResult'

describe('on hover', () => {
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
    bitBakeDocScanner.clearScannedDocs()
  })

  const hoverAt = async (line: number, character: number): ReturnType<typeof onHoverHandler> => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })
    return await onHoverHandler({
      textDocument: { uri: DUMMY_URI },
      position: { line, character }
    })
  }

  const containing = (text: string): unknown => expect.objectContaining({
    contents: expect.objectContaining({
      value: expect.stringContaining(text)
    })
  })

  it('shows definition on hovering variable in variable assignment syntax or in variable expansion syntax after scanning the docs', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    analyzer.analyze({
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
    analyzer.analyze({
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
    analyzer.analyze({
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
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
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

  it('should show hover definition for the inherit_defer keyword', async () => {
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DIRECTIVE
    })

    const shouldShow = await onHoverHandler({
      textDocument: { uri: DUMMY_URI },
      position: { line: 34, character: 2 }
    })
    const shouldNotShow = await onHoverHandler({
      textDocument: { uri: DUMMY_URI },
      position: { line: 34, character: 15 }
    })

    expect(shouldShow).toEqual(containing('**inherit_defer**'))
    expect(shouldNotShow).not.toEqual(containing('**inherit_defer**'))
  })

  it('should not show RST reference targets in directive documentation', async () => {
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const hover = await onHoverHandler({
      textDocument: { uri: DUMMY_URI },
      position: { line: 31, character: 1 }
    })

    expect(hover).toEqual(containing('**include**'))
    expect(hover).not.toEqual(containing('<bitbake-user-manual'))
  })

  it('shows definition on hovering variable in Python functions for accessing datastore', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parsePythonDatastoreFunction()
    analyzer.analyze({
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
        line: 37,
        character: 37
      }
    })

    const shouldShow4 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 41,
        character: 19
      }
    })

    const shouldShow5 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 47,
        character: 20
      }
    })

    const shouldShow6 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 45,
        character: 14
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 35,
        character: 33
      }
    })

    const shouldNotShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 38,
        character: 14
      }
    })

    const shouldNotShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 39,
        character: 12
      }
    })

    const shouldNotShow4 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 40,
        character: 19
      }
    })

    const shouldNotShow5 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 56,
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

    expect(shouldShow6).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldNotShow1).toBe(null)
    expect(shouldNotShow2).toBe(null)
    expect(shouldNotShow3).toBe(null)
    expect(shouldNotShow4).toBe(null)
    expect(shouldNotShow5).toBe(null)
  })

  it('shows definition on hovering variable expansion inside bash region', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 50,
        character: 9
      }
    })

    const shouldNotShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 50,
        character: 21
      }
    })

    expect(shouldShow1).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })

    expect(shouldNotShow1).toBe(null)
  })

  it('shows definition on hovering simple variable expansion inside bash region', async () => {
    bitBakeDocScanner.parseBitbakeVariablesFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 51,
        character: 9
      }
    })

    expect(shouldShow1).toEqual({
      contents: {
        kind: 'markdown',
        value: '**DESCRIPTION**\n___\n   A long description for the recipe.\n\n'
      }
    })
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
      _recipes: [],
      _confFiles: []
    } as unknown as BitbakeScanResult

    analyzer.analyze({
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
          value: ` comment 1 for MYVAR in baz.bbclass\n\nSource: ${FIXTURE_DOCUMENT.BAZ_BBCLASS.uri.replace('file://', '')} \`L: 4\``
        })
      })
    )

    // show comments for custom function
    expect(shouldShow2).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: ` comment 1 for my_func\n\nSource: ${DUMMY_URI_TRIMMED} \`L: 23\``
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

  it('should show final value of the variable after the scan results are available', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.CORRECT
    })

    const scanResults = '#INCLUDE HISTORY\n# Some scan results here\nFINAL_VALUE = \'this is the final value for FINAL_VALUE\'\nFINAL_VALUE:o1 = \'this is the final value for FINAL_VALUE with override o1\'\nFINAL_VALUE:o1:pn:pn-foo = \'this is the final value for FINAL_VALUE with override containing variable expansion\'\nPN= \'pn\'\n'

    analyzer.processRecipeScanResults(scanResults, extractRecipeName(DUMMY_URI))

    const shouldShow1 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 9,
        character: 1
      }
    })

    const shouldShow2 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 10,
        character: 1
      }
    })

    const shouldShow3 = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 14,
        character: 1
      }
    })

    expect(shouldShow1).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('**Final Value**\n___\n\t\'this is the final value for FINAL_VALUE\'')
        })
      })
    )

    expect(shouldShow2).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('**Final Value**\n___\n\t\'this is the final value for FINAL_VALUE with override o1\'')
        })
      })
    )

    expect(shouldShow3).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('**Final Value**\n___\n\t\'this is the final value for FINAL_VALUE with override containing variable expansion\'')
        })
      })
    )
  })

  it('should show hover documentation for assignment operators', async () => {
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 56,
        character: 6
      }
    })

    expect(shouldShow).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('occurs immediately as the statement is parsed')
        })
      })
    )
  })

  it('should show hover documentation for override style operators', async () => {
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 64,
        character: 6
      }
    })

    expect(shouldShow).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('You can also append and prepend a variable')
        })
      })
    )
  })

  it('should not show hover for append when not used as an operator', async () => {
    bitBakeDocScanner.parseBitbakeMetadataFile()
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldNotShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 64,
        character: 20
      }
    })

    expect(shouldNotShow).toBe(null)
  })

  describe('python keywords', () => {
    beforeEach(() => {
      bitBakeDocScanner.parseBitbakeMetadataFile()
    })

    it('should show hover documentation for the python keyword', async () => {
      expect(await hoverAt(70, 2)).toEqual(containing('**python**'))
    })

    it('should show hover documentation for the def keyword', async () => {
      expect(await hoverAt(74, 1)).toEqual(containing('**def**'))
    })

    it('should show hover documentation for inline python expansion', async () => {
      expect(await hoverAt(77, 11)).toEqual(containing('**${@**'))
    })

    it('should show hover documentation for __anonymous', async () => {
      expect(await hoverAt(79, 9)).toEqual(containing('**__anonymous**'))
    })

    it('should show anonymous function documentation for the python keyword of an unnamed function', async () => {
      expect(await hoverAt(83, 2)).toEqual(containing('**__anonymous**'))
    })

    it('should not show python keyword documentation on function names', async () => {
      expect(await hoverAt(70, 8)).toBe(null)
      expect(await hoverAt(74, 6)).toBe(null)
    })
  })

  describe('export keyword', () => {
    beforeEach(() => {
      bitBakeDocScanner.parseBitbakeMetadataFile()
    })

    it('should show hover documentation for export combined with an assignment', async () => {
      expect(await hoverAt(87, 2)).toEqual(containing('**export**'))
    })

    it('should show hover documentation for a standalone export statement', async () => {
      expect(await hoverAt(88, 2)).toEqual(containing('**export**'))
    })

    it('should not show export documentation on the exported variable name', async () => {
      expect(await hoverAt(88, 10)).not.toEqual(containing('**export**'))
    })
  })

  describe('statement keywords', () => {
    beforeEach(() => {
      bitBakeDocScanner.parseBitbakeMetadataFile()
    })

    it('should show hover documentation for addtask', async () => {
      expect(await hoverAt(90, 2)).toEqual(containing('**addtask**'))
    })

    it('should show addtask documentation for its before and after arguments', async () => {
      expect(await hoverAt(90, 15)).toEqual(containing('**addtask**'))
    })

    it('should not show addtask documentation on task names', async () => {
      expect(await hoverAt(90, 9)).not.toEqual(containing('**addtask**'))
      expect(await hoverAt(90, 22)).not.toEqual(containing('**addtask**'))
    })

    it('should show hover documentation for deltask', async () => {
      expect(await hoverAt(91, 2)).toEqual(containing('**deltask**'))
    })

    it('should not show deltask documentation on its argument', async () => {
      expect(await hoverAt(91, 10)).not.toEqual(containing('**deltask**'))
    })

    it('should show hover documentation for addhandler', async () => {
      expect(await hoverAt(92, 2)).toEqual(containing('**addhandler**'))
    })

    it('should not show addhandler documentation on its argument', async () => {
      expect(await hoverAt(92, 13)).not.toEqual(containing('**addhandler**'))
    })

    it('should show hover documentation for unset', async () => {
      expect(await hoverAt(93, 2)).toEqual(containing('**unset**'))
    })

    it('should not show unset documentation on its argument', async () => {
      expect(await hoverAt(93, 8)).not.toEqual(containing('**unset**'))
    })

    it('should show hover documentation for EXPORT_FUNCTIONS', async () => {
      expect(await hoverAt(94, 2)).toEqual(containing('**EXPORT_FUNCTIONS**'))
    })

    it('should not show EXPORT_FUNCTIONS documentation on its argument', async () => {
      expect(await hoverAt(94, 19)).not.toEqual(containing('**EXPORT_FUNCTIONS**'))
    })
  })

  it('should show description of license on hover', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.HOVER
    })

    const shouldShow = await onHoverHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 54,
        character: 43
      }
    })

    expect(shouldShow).toEqual(
      expect.objectContaining({
        contents: expect.objectContaining({
          value: expect.stringContaining('**GNU General Public License v2.0 w/Bison exception** (deprecated)\n___\n```Bison Exception')
        })
      })
    )
  })
})
