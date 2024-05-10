/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { onCompletionHandler } from '../connectionHandlers/onCompletion'
import { analyzer } from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT, DUMMY_URI, FIXTURE_URI } from './fixtures/fixtures'
import { generateBashParser, generateBitBakeParser } from '../tree-sitter/parser'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path from 'path'
import { extractRecipeName } from '../lib/src/utils/files'

/**
 * The onCompletion handler doesn't allow other parameters, so we can't pass the analyzer and therefore the same
 * instance used in the handler is used here. Documents are reset before each test for a clean state.
 * A possible alternative is making the entire server a class and the analyzer a member
 */
describe('On Completion', () => {
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

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('expects reserved variables, keywords and snippets in completion item lists', async () => {
    // nothing is analyzed yet, and docs are not scanned. Only the static and fallback completion items are provided
    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 0,
        character: 1
      }
    })

    expect('length' in result).toBe(true)

    expect(result).toEqual(
      expect.arrayContaining([
        {
          kind: 14,
          label: 'python'
        }
      ])
    )

    expect(result).toEqual(
      expect.arrayContaining([
        {
          kind: 6,
          label: 'DESCRIPTION'
        }
      ])
    )

    // Scan docs
    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()
    bitBakeDocScanner.parseYoctoTaskFile()

    const resultAfterDocScan = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 0,
        character: 1
      }
    })
    // Yocto tasks
    expect(resultAfterDocScan).toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\ndo_build (bitbake-language-server)\n\n\n```\n```bitbake\ndo_build(){\n\t# Your code here\n}\n```\n---\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n\n[Reference](https://docs.yoctoproject.org/singleindex.html#do-build)',
            kind: 'markdown'
          },
          labelDetails: {
            description: ''
          },
          insertText: 'do_build(){\n\t${1:# Your code here}\n}',
          insertTextFormat: 2,
          label: 'do_build',
          kind: 15
        }
      ])
    )
    // Variables from yocto docs after filtering the duplicates
    expect(resultAfterDocScan).toEqual(
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          labelDetails: {
            description: 'Source: Yocto'
          },
          insertText: undefined,
          insertTextFormat: 1,
          label: 'DESCRIPTION',
          kind: 6
        }
      ])
    )
    // Duplicate variables from bitbake docs should not be included
    expect(resultAfterDocScan).not.toEqual(
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   A long description for the recipe.\n\n\n[Reference](https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-ref-variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          labelDetails: {
            description: 'Source: Bitbake'
          },
          insertText: undefined,
          insertTextFormat: 1,
          label: 'DESCRIPTION',
          kind: 6
        }
      ])
    )

    // Variables from bitbake docs after filtering the duplicates
    expect(resultAfterDocScan).toEqual(
      expect.arrayContaining([
        {
          documentation: {
            /* eslint-disable no-useless-escape */
            value: '```man\nBB_HASH_CODEPARSER_VALS (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   Specifies values for variables to use when populating the codeparser cache.\n   This can be used selectively to set dummy values for variables to avoid\n   the codeparser cache growing on every parse. Variables that would typically\n   be included are those where the value is not significant for where the\n   codeparser cache is used (i.e. when calculating variable dependencies for\n   code fragments.) The value is space-separated without quoting values, for\n   example:\n BB_HASH_CODEPARSER_VALS = \"T=/ WORKDIR=/ DATE=1234 TIME=1234\"\n\n\n[Reference](https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-ref-variables.html#term-BB_HASH_CODEPARSER_VALS)',
            kind: 'markdown'
          },
          labelDetails: {
            description: 'Source: Bitbake'
          },
          insertText: undefined,
          insertTextFormat: 1,
          label: 'BB_HASH_CODEPARSER_VALS',
          kind: 6
        }
      ])
    )

    // Variables from Yocto docs but not in bitbake docs
    expect(resultAfterDocScan).toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\nAPPEND (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   An override list of append strings for each target specified with\n   `LABELS`.\n\n   See the `ref-classes-grub-efi` class for more\n   information on how this variable is used.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-APPEND)',
            kind: 'markdown'
          },
          labelDetails: {
            description: 'Source: Yocto'
          },
          insertText: undefined,
          insertTextFormat: 1,
          label: 'APPEND',
          kind: 6
        }
      ])
    )
  })

  it("doesn't provide suggestions when it is in a string content that is not allowed to have completion", async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 10
      }
    })

    expect(result).toEqual([])
  })

  it('provides recipe (.bb) suggestions in the string conent of certain variable assignments', async () => {
    bitBakeProjectScannerClient.bitbakeScanResult._recipes = [{
      name: 'busybox',
      path: {
        root: '/',
        dir: '/home/projects/poky/meta/recipe-core',
        base: 'busybox.bb',
        ext: '.bb',
        name: 'busybox'
      },
      extraInfo: 'layer: core',
      layerInfo: {
        name: 'core',
        path: '/home/projects/poky/meta',
        priority: 5
      }
    }]

    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DIRECTIVE
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 26,
        character: 20
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'busybox',
            kind: 8,
            insertText: 'busybox'
          }
        )
      ])
    )
  })

  it('provides uri suggestions in the SRC_URI', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.CORRECT
    })

    const recipeLocalFiles = {
      foundFileUris: [
        'file:///home/projects/poky/meta/recipe-core/busybox/foo',
        'file:///home/projects/poky/meta/recipe-core/busybox/bar'
      ],
      foundDirs: [
        'file:///home/projects/poky/meta/recipe-core/busybox/busybox/images'
      ]
    }

    analyzer.setRecipeLocalFiles(DUMMY_URI, recipeLocalFiles)

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 6,
        character: 25
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'foo',
            kind: 17,
            insertText: 'file://foo'
          }
        ),
        expect.objectContaining(
          {
            label: 'bar',
            kind: 17,
            insertText: 'file://bar'
          }
        ),
        expect.objectContaining(
          {
            label: 'images',
            kind: 19,
            insertText: 'file://images/'
          }
        )
      ])
    )
  })

  it("doesn't provide duplicate completion items for local custom variables", async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 0,
        character: 0
      }
    })

    let occurances = 0
    result.forEach((item) => {
      if (item.label === 'MYVAR') {
        occurances++
      }
    })

    expect(occurances).toBe(1)
  })

  it('provides necessary suggestions when it is in variable expansion', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result1 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 13
      }
    })
    // Empty ${}
    const result2 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 8,
        character: 11
      }
    })

    expect(result1).not.toEqual([])
    expect(result1).not.toEqual(
      expect.arrayContaining([
        {
          kind: 14,
          label: 'python'
        }
      ])
    )
    expect(result2).not.toEqual([])
    expect(result2).not.toEqual(
      expect.arrayContaining([
        {
          kind: 14,
          label: 'python'
        }
      ])
    )
  })
  // TODO: Add tests for the second and other overrides that come after. e.g. VAR:override1:override2:over...  And it is better after the tree-sitter library can properly handle it as mentioned in the issue: https://github.com/amaanq/tree-sitter-bitbake/issues/9
  it('provides suggestions for operators when a ":" is typed and it follows an identifier or in the middle of typing such syntax', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 6
      }
    })

    // In the middle of typing operator/override syntax
    const result2 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 7
      }
    })
    // MYVAR:append: = '123' when the cursor is at the end of second colon
    const result3 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 9,
        character: 13
      }
    })
    // Show completion at the last line of the document https://github.com/amaanq/tree-sitter-bitbake/issues/9
    const result4 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 36,
        character: 13
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )

    expect(result2).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )

    expect(result3).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )

    expect(result4).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )
  })

  it('provides suggestions for overrides when a ":" is typed and it follows an identifier', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeProjectScannerClient.bitbakeScanResult._overrides = ['class-target']

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 6
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'class-target',
            kind: 10
          }
        )
      ])
    )
  })

  it('provides no suggestions when a ":" is typed but it is not part of a valid override syntax', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 14,
        character: 28
      }
    })

    expect(result).toEqual([])
  })

  it('provides suggestions for variable flags when a "[" is typed and it follows an identifier (Before and After scanning docs', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 3,
        character: 6
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: 'cleandirs',
          kind: 14
        }
      ])
    )

    bitBakeDocScanner.parseVariableFlagFile()

    const resultAfterDocScan = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 3,
        character: 6
      }
    })

    expect(resultAfterDocScan).toEqual(
      expect.arrayContaining([
        {
          label: 'cleandirs',
          documentation: {
            value: '```man\ncleandirs (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n Empty directories that should be created before\n   the task runs. Directories that already exist are removed and\n   recreated to empty them.\n\n[Reference](https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#variable-flags)',
            kind: 'markdown'
          },
          labelDetails: {
            description: ''
          },
          insertText: undefined,
          insertTextFormat: 1,
          kind: 14
        }
      ])
    )
  })

  it('provides no suggestions when a "[" is typed but it doesn\'t follow a bitbake identifier', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result1 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 14,
        character: 20
      }
    })

    const result2 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 6,
        character: 10
      }
    })

    expect(result1).toEqual([])
    expect(result2).toEqual([])
  })

  it('provides suggestions for direcitive statement after keywords "include", "inherit" and "requrie" are typed', async () => {
    const documentUri = 'file:///home/projects/poky/meta/conf-2/path/to/dummy.bb'
    bitBakeProjectScannerClient.bitbakeScanResult._includes = [
      {
        name: 'init-manager-none',
        path: {
          root: '/',
          dir: '/home/projects/poky/meta/conf/distro/include',
          base: 'init-manager-none.inc',
          ext: '.inc',
          name: 'init-manager-none'
        },
        extraInfo: 'layer: core',
        layerInfo: {
          name: 'core',
          path: '/home/projects/poky/meta',
          priority: 5
        }
      },
      {
        name: 'init-manager-none-2',
        path: {
          root: '/',
          dir: '/home/projects/poky/meta/conf-2/distro/include', // Note that this fake path is under the same "conf-2" folder as the documentUri
          base: 'init-manager-none-2.inc',
          ext: '.inc',
          name: 'init-manager-none-2'
        },
        extraInfo: 'layer: core',
        layerInfo: {
          name: 'core',
          path: '/home/projects/poky/meta',
          priority: 5
        }
      }
    ]

    bitBakeProjectScannerClient.bitbakeScanResult._classes = [{
      name: 'copyleft_filter',
      path: {
        root: '/',
        dir: '/home/projects/poky/meta/classes',
        base: 'copyleft_filter.bbclass',
        ext: '.bbclass',
        name: 'copyleft_filter'
      },
      extraInfo: 'layer: core',
      layerInfo: {
        name: 'core',
        path: '/home/projects/poky/meta',
        priority: 5
      }
    }]

    bitBakeProjectScannerClient.bitbakeScanResult._recipes = [{
      name: 'busybox',
      path: {
        root: '/',
        dir: '/home/projects/poky/meta/recipe-core',
        base: 'busybox.bb',
        ext: '.bb',
        name: 'busybox'
      },
      extraInfo: 'layer: core',
      layerInfo: {
        name: 'core',
        path: '/home/projects/poky/meta',
        priority: 5
      }
    }]

    analyzer.analyze({
      uri: documentUri,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const resultForInclude = onCompletionHandler({
      textDocument: {
        uri: documentUri
      },
      position: {
        line: 10,
        character: 9
      }
    })

    const resultForRequire = onCompletionHandler({
      textDocument: {
        uri: documentUri
      },
      position: {
        line: 11,
        character: 9
      }
    })

    const resultForInherit = onCompletionHandler({
      textDocument: {
        uri: documentUri
      },
      position: {
        line: 12,
        character: 9
      }
    })

    const resultForInheritDefer = onCompletionHandler({
      textDocument: {
        uri: documentUri
      },
      position: {
        line: 13,
        character: 14
      }
    })

    expect(resultForInheritDefer).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'copyleft_filter',
            kind: 7,
            insertText: 'copyleft_filter'
          }
        )
      ])
    )

    expect(resultForInclude).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'init-manager-none.inc',
            kind: 8,
            insertText: 'conf/distro/include/init-manager-none.inc'
          }
        )
      ])
    )

    const index1 = resultForInclude.findIndex((item) => item.label === 'init-manager-none.inc')
    const index2 = resultForInclude.findIndex((item) => item.label === 'init-manager-none-2.inc')
    // Since the path of "init-manager-none-2.inc" is under the same "conf-2" folder as the documentUri, it should be suggested first
    expect(index2).toBeLessThan(index1)

    expect(resultForRequire).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'init-manager-none.inc',
            kind: 8,
            insertText: 'conf/distro/include/init-manager-none.inc'
          }
        ),
        expect.objectContaining(
          {
            label: 'busybox.bb',
            detail: 'busybox.bb',
            kind: 8,
            insertText: 'recipe-core/busybox.bb'
          }
        )
      ])
    )

    expect(resultForInherit).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'copyleft_filter',
            kind: 7,
            insertText: 'copyleft_filter'
          }
        )
      ])
    )
  })

  it('provides extra symbols from files in the directive statements', async () => {
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
      _confFiles: [],
      _workspaces: []
    }

    analyzer.analyze({
      uri: FIXTURE_URI.DIRECTIVE,
      document: FIXTURE_DOCUMENT.DIRECTIVE
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: FIXTURE_URI.DIRECTIVE
      },
      position: {
        line: 0,
        character: 0
      }
    })
    // Show only one completion item for each symbol
    let occurances = 0
    result.forEach(item => {
      item.label === 'DESCRIPTION' && occurances++
    })

    expect(occurances).toEqual(1)
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: path.relative(FIXTURE_URI.DIRECTIVE.replace('file://', ''), FIXTURE_URI.FOO_INC.replace('file://', '')) // In this test case, the one that remains after the filtering is the relative path from directive.bb to foo.inc
          }
        })
      ])
    )
    // PYTHON is in export statement
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'PYTHON',
          labelDetails: {
            description: path.relative(FIXTURE_URI.DIRECTIVE.replace('file://', ''), FIXTURE_URI.BAR_INC.replace('file://', ''))
          }
        })
      ])
    )

    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()

    const result2 = onCompletionHandler({
      textDocument: {
        uri: FIXTURE_URI.DIRECTIVE
      },
      position: {
        line: 0,
        character: 0
      }
    })
    // When it is a variable existing in the docs, the completion item should have documentation etc.
    expect(result2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: path.relative(FIXTURE_URI.DIRECTIVE.replace('file://', ''), FIXTURE_URI.FOO_INC.replace('file://', ''))
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )
    // The variables from docs should be filtered out if they exist in the extra symbols
    expect(result2).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )
  })

  it('provides proper completion items on python datastore variables', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()
    bitBakeDocScanner.parseYoctoTaskFile()
    bitBakeDocScanner.parsePythonDatastoreFunction()

    // Completion items on string_start node
    const resultOnStringStart = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 19,
        character: 14
      }
    })

    // string_start has Yocto variable among the completion items
    expect(resultOnStringStart).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )

    // string_start has symbol among the completion items
    expect(
      resultOnStringStart.find((item) => item.label === 'DVAR')
    ).toBeDefined()

    // string_start does not have task among the completion items
    expect(resultOnStringStart).not.toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\ndo_build (bitbake-language-server)\n\n\n```\n```bitbake\ndo_build(){\n\t# Your code here\n}\n```\n---\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n\n[Reference](https://docs.yoctoproject.org/singleindex.html#do-build)',
            kind: 'markdown'
          },
          labelDetails: {
            description: ''
          },
          insertText: 'do_build(){\n\t${1:# Your code here}\n}',
          insertTextFormat: 2,
          label: 'do_build',
          kind: 15
        }
      ])
    )

    // string_start does not have reserved word among the completion items
    expect(
      resultOnStringStart.find((item) => item.label === 'deltask')
    ).toBeUndefined()

    // Completion items on string_content node
    const resultOnStringContent = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 19,
        character: 15
      }
    })

    // string_content has Yocto variable among the completion items
    expect(resultOnStringContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )

    // string_content has symbol among the completion items
    expect(
      resultOnStringContent.find((item) => item.label === 'DVAR')
    ).toBeDefined()

    // string_content does not have task among the completion items
    expect(resultOnStringContent).not.toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\ndo_build (bitbake-language-server)\n\n\n```\n```bitbake\ndo_build(){\n\t# Your code here\n}\n```\n---\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n\n[Reference](https://docs.yoctoproject.org/singleindex.html#do-build)',
            kind: 'markdown'
          },
          labelDetails: {
            description: ''
          },
          insertText: 'do_build(){\n\t${1:# Your code here}\n}',
          insertTextFormat: 2,
          label: 'do_build',
          kind: 15
        }
      ])
    )

    // string_content does not have reserved word among the completion items
    expect(
      resultOnStringContent.find((item) => item.label === 'deltask')
    ).toBeUndefined()
  })

  it('provides proper completion items on variable expansion in bash', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()

    const resultInVariableExpansion = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 27,
        character: 8
      }
    })

    expect(resultInVariableExpansion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )

    const resultNotInVariableExpansion = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 27,
        character: 11
      }
    })
    expect(
      resultNotInVariableExpansion.find((item) => item.label === 'DESCRIPTION')
    ).toBeUndefined()
  })

  it('provides proper completion items on simple variable expansion in bash', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()

    const resultInVariableExpansion = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 28,
        character: 6
      }
    })

    expect(resultInVariableExpansion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )
  })

  it('provides common directories completion items where it is appropriate', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeDocScanner.parseBitbakeVariablesFile()
    bitBakeDocScanner.parseYoctoVariablesFile()
    bitBakeDocScanner.parseYoctoTaskFile()
    bitBakeDocScanner.parsePythonDatastoreFunction()

    const resultOnVariableExpansion = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 13
      }
    })
    expect(
      resultOnVariableExpansion.find((item) => item.label === 'FULL_OPTIMIZATION')
    ).toBeDefined()

    const pnCompletionItems = resultOnVariableExpansion.filter((item) => item.label === 'PN')
    expect(pnCompletionItems.length).toBe(1) // not duplicated with common directories
    expect(pnCompletionItems[0].labelDetails?.description).toBe('Source: Yocto') // Not overridden by common directories

    const resultOnPythonDatastoreVariable = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 19,
        character: 15
      }
    })
    expect(
      resultOnPythonDatastoreVariable.find((item) => item.label === 'DEBIAN_MIRROR')
    ).toBeDefined()

    const resultOnVariableAssignation = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 17,
        character: 1
      }
    })
    expect(
      resultOnVariableAssignation.find((item) => item.label === 'DEBIAN_MIRROR')
    ).toBeUndefined()
  })

  it('provides proper completion items on incomplete variable assignment', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    bitBakeDocScanner.parseYoctoVariablesFile()

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 22,
        character: 1
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'DESCRIPTION',
          labelDetails: {
            description: 'Source: Yocto'
          },
          documentation: {
            value: '```man\nDESCRIPTION (bitbake-language-server)\n\n\n```\n```bitbake\n\n```\n---\n   The package description used by package managers. If not set,\n   `DESCRIPTION` takes the value of the `SUMMARY`\n   variable.\n\n\n[Reference](https://docs.yoctoproject.org/ref-manual/variables.html#term-DESCRIPTION)',
            kind: 'markdown'
          },
          insertText: undefined,
          insertTextFormat: 1
        })
      ])
    )
  })

  it('provides proper completion items on incomplete variable assignment with override', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 31,
        character: 12
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )
  })

  it('provides additional completion items using symbols found in the scan results (bitbake -e)', async () => {
    analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const scanResults = "#  INCLUDE HISTORY\r\n#\r\nFOO_SCAN='123'\r\n#\r\nBAR_SCAN='456'\r\n#\r\nBAZ_SCAN='789'\r\n#\r\n"

    analyzer.processRecipeScanResults(scanResults, extractRecipeName(DUMMY_URI))

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 22,
        character: 1
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'FOO_SCAN'
        }),
        expect.objectContaining({
          label: 'BAR_SCAN'
        }),
        expect.objectContaining({
          label: 'BAZ_SCAN'
        })
      ])
    )
  })
})
