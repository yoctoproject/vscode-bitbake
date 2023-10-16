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
      expect.arrayContaining([
        {
          documentation: {
            /* eslint-disable no-template-curly-in-string */
            value: '```man\nDeploy something (bitbake-language-server)\n\n\n```\n```bitbake\ndef do_deploy():\n\t# Your code here\n\t${1:pass}\n```',
            kind: 'markdown'
          },
          insertText: [
            'def do_deploy():',
            '\t# Your code here',
            /* eslint-disable no-template-curly-in-string */
            '\t${1:pass}'
          ].join('\n'),
          insertTextFormat: 2,
          label: 'do_deploy',
          kind: 15
        }
      ])
    )
  })
})
