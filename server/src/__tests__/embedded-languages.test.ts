/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { randomUUID } from 'crypto'

import { generateEmbeddedLanguageDocs, getEmbeddedLanguageTypeOnPosition } from '../embedded-languages/general-support'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { imports } from '../embedded-languages/python-support'
import { bashHeader } from '../embedded-languages/bash-support'

describe('Create basic embedded bash documents', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  test.each([
    [
      'basic',
      'foo(){\nBAR=""\n}',
      `${bashHeader}foo(){\nBAR=""\n}`
    ],
    [
      'with override',
      'foo:append(){\nBAR=""\n}',
      `${bashHeader}foo       (){\nBAR=""\n}`
    ],
    [
      'with inline python',
      // eslint-disable-next-line no-template-curly-in-string
      'foo(){\n${@FOO}\n}',
      `${bashHeader}foo(){\n\${?   }\n}`
    ],
    [
      'with fakeroot',
      'fakeroot foo(){\nBAR=""\n}',
      `${bashHeader}         foo(){\nBAR=""\n}`
    ]
  ])('%s', async (description, input, result) => {
    const embeddedContent = await createEmbeddedContent(input, 'bash')
    expect(embeddedContent).toEqual(result)
  })
})

describe('Create various basic embedded python documents', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  test.each([
    [
      'anonymous',
      'python(){\n  pass\n}',
      `${imports}def _ ():\n  pass\n `
    ],
    [
      'named with python keyword',
      'python foo (){\n  pass\n}',
      `${imports}def foo ():\n  pass\n `
    ],
    [
      'empty',
      'python(){\n}',
      `${imports}def _ ():\n  pass\n `
    ],
    [
      'with def keyword',
      'def foo():\n  pass',
      `${imports}def foo():\n  pass`
    ],
    [
      'with fakeroot',
      'fakeroot python(){\n  pass\n}',
      `${imports}def _ ():\n  pass\n `
    ]
  ])('%s', async (description, input, result) => {
    const embeddedContent = await createEmbeddedContent(input, 'python')
    expect(embeddedContent).toEqual(result)
  })
})

describe('Create Python embedded language content with inline Python', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  test.each([
    [
      'basic',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = \'${@"BAR"}\'',
      `${imports}         \n\n"BAR"\n `
    ],
    [
      'with spacing',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = \'${@  "BAR"  }\'',
      `${imports}         \n  \n"BAR"  \n `
    ],
    [
      'multiline',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = \'${@"BAR"}\' \\\n1 \\\n2"',
      `${imports}         \n\n"BAR"\n   \n   \n  `
    ],
    [
      'with two embedded python regions',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = \'${@"BAR"}${@"BAR"}\'',
      `${imports}         \n\n"BAR"\n  \n\n"BAR"\n `
    ],
    [
      'without surrounding quotes',
      // eslint-disable-next-line no-template-curly-in-string
      'inherit ${@"test"}',
      `${imports}          \n\n"test"\n`
    ],
    [
      'inside bash function',
      // eslint-disable-next-line no-template-curly-in-string
      'foo(){\n${@FOO}\n}',
      `${imports}      \n  \n\nFOO\n\n `
    ]
  ])('%s', async (description, input, result) => {
    const embeddedContent = await createEmbeddedContent(input, 'python')
    expect(embeddedContent).toEqual(result)
  })
})

describe('Finds proper embedded language type', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  test.each([
    [
      'BitBake variable',
      'BAR = "TEST"',
      { line: 0, character: 1 },
      undefined
    ],
    [
      'Bash function',
      'foo(){\n  BAR=""\n}',
      { line: 0, character: 3 },
      'bash'
    ],
    [
      'BitBake-Style Python Function',
      'python(){\n  pass\n}',
      { line: 1, character: 3 },
      'python'
    ],
    [
      'Python function',
      'def foo():\n  pass',
      { line: 1, character: 3 },
      'python'
    ],
    [
      'Inline Python',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = "${@BAR}"',
      { line: 0, character: 11 },
      'python'
    ],
    [
      'Inline Python into Bash function',
      // eslint-disable-next-line no-template-curly-in-string
      'foo(){\n  ${@BAR}\n}',
      { line: 1, character: 6 },
      'python'
    ]
  ])('%s', async (description, content, position, result) => {
    const uri = randomUUID()
    analyzer.analyze({ document: TextDocument.create(uri, 'bitbake', 1, content), uri })
    const type = getEmbeddedLanguageTypeOnPosition(uri.toString(), position)
    expect(type).toEqual(result)
  })
})

const createEmbeddedContent = async (content: string, language: EmbeddedLanguageType): Promise<string | undefined> => {
  const uri = randomUUID()
  const document = TextDocument.create(uri, 'bitbake', 1, content)
  analyzer.analyze({ document, uri })
  const embeddedLanguageDocs = generateEmbeddedLanguageDocs(document)
  analyzer.resetAnalyzedDocuments()
  return embeddedLanguageDocs?.find((embeddedLanguageDoc) => embeddedLanguageDoc.language === language)?.content
}
