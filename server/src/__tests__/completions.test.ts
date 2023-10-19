/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { onCompletionHandler } from '../connectionHandlers/onCompletion'
import { analyzer } from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { generateParser } from '../tree-sitter/parser'

const DUMMY_URI = 'dummy_uri'

/**
 * The onCompletion handler doesn't allow other parameters, so we can't pass the analyzer and therefore the same
 * instance used in the handler is used here. Documents are reset before each test for a clean state.
 * A possible alternative is making the entire server a class and the analyzer a member
 */
describe('On Completion', () => {
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

  it('expects reserved variables, keywords and snippets in completion item lists', async () => {
    // nothing is analyzed yet, only the static completion items are provided
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

    expect(result).toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\ndo_bootimg (bitbake-language-server)\n\n\n```\n```bitbake\ndef do_bootimg():\n\t# Your code here\n\t${1:pass}\n```\n---\nCreates a bootable live image. See the IMAGE_FSTYPES variable for additionalinformation on live image types.\n\n[Reference](https://docs.yoctoproject.org/singleindex.html#do-bootimg)',
            kind: 'markdown'
          },
          insertText: [
            'def do_bootimg():',
            '\t# Your code here',
            '\t${1:pass}'
          ].join('\n'),
          insertTextFormat: 2,
          label: 'do_bootimg',
          kind: 15
        }
      ])
    )
  })

  it("doesn't provide suggestions when it is pure string content", async () => {
    await analyzer.analyze({
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

  it('provides suggestions when it is in variable expansion', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 13
      }
    })

    expect(result).not.toEqual([])
  })
})
