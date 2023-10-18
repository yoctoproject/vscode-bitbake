import { onCompletionHandler } from '../connectionHandlers/onCompletion'

const DUMMY_URI = 'dummy_uri'

describe('On Completion', () => {
  it('expects reserved variables, keywords and snippets in completion item lists', async () => {
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
})
