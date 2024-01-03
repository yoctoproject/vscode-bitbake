/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import { randomUUID } from 'crypto'

import { embeddedLanguageDocsManager } from '../embedded-languages/documents-manager'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageDocInfosOnPosition } from '../embedded-languages/general-support'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { imports } from '../embedded-languages/python-support'

describe('Embedded Language Documents file management', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
    await embeddedLanguageDocsManager.setStoragePath(__dirname)
  })

  beforeEach(() => {
    analyzer.resetAnalyzedDocuments()
  })

  it('generate, rename and delete embedded language documents', async () => {
    // Setup
    analyzer.analyze({
      uri: FIXTURE_DOCUMENT.EMBEDDED.uri,
      document: FIXTURE_DOCUMENT.EMBEDDED
    })

    await generateEmbeddedLanguageDocs(FIXTURE_DOCUMENT.EMBEDDED)

    // Test embedded documents infos
    const bashEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')
    if (bashEmbeddedLanguageDocInfos === undefined) {
      expect(bashEmbeddedLanguageDocInfos).not.toBeUndefined()
      return
    }
    expect(bashEmbeddedLanguageDocInfos.language).toEqual('bash')

    const pythonEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')
    if (pythonEmbeddedLanguageDocInfos === undefined) {
      expect(bashEmbeddedLanguageDocInfos).not.toBeUndefined()
      return
    }
    expect(pythonEmbeddedLanguageDocInfos?.language).toEqual('python')

    // Test embedded documents contents
    const bashEmbeddedLanguageDocPath = bashEmbeddedLanguageDocInfos.uri.replace('file://', '')
    const bashEmbeddedLanguageDoc = fs.readFileSync(bashEmbeddedLanguageDocPath, 'utf8')
    expect(bashEmbeddedLanguageDoc).toEqual(expectedBashEmbeddedLanguageDoc)

    const pythonEmbeddedLanguageDocPath = pythonEmbeddedLanguageDocInfos.uri.replace('file://', '')
    const pythonEmbeddedLanguageDoc = fs.readFileSync(pythonEmbeddedLanguageDocPath, 'utf8')
    expect(pythonEmbeddedLanguageDoc).toEqual(expectedPythonEmbeddedLanguageDoc)

    // Test returned embedded documents for positions
    const undefinedDocumentUri = getEmbeddedLanguageDocInfosOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 0, character: 0 }
    )
    expect(undefinedDocumentUri).toBeUndefined()

    const bashEmbeddedLanguageDocInfosOnPosition = getEmbeddedLanguageDocInfosOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 8, character: 0 }
    )
    expect(bashEmbeddedLanguageDocInfosOnPosition).toEqual(bashEmbeddedLanguageDocInfos)

    const pythonEmbeddedLanguageDocInfosOnPosition = getEmbeddedLanguageDocInfosOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 3, character: 0 }
    )
    expect(pythonEmbeddedLanguageDocInfosOnPosition).toEqual(pythonEmbeddedLanguageDocInfos)

    // Test saving the document a second time does not create a new file
    await generateEmbeddedLanguageDocs(FIXTURE_DOCUMENT.EMBEDDED)
    const bashEmbeddedLanguageDocInfos2 = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')
    expect(bashEmbeddedLanguageDocInfos2?.uri).toEqual(bashEmbeddedLanguageDocInfos.uri)

    const pythonEmbeddedLanguageDocInfos2 = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')
    expect(pythonEmbeddedLanguageDocInfos2?.uri).toEqual(pythonEmbeddedLanguageDocInfos.uri)

    // Test moving embedded documents
    const newUri = 'dummy'
    embeddedLanguageDocsManager.renameEmbeddedLanguageDocs(FIXTURE_DOCUMENT.EMBEDDED.uri, newUri)
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')).toBeUndefined()
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')).toBeUndefined()
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(newUri, 'bash')).toEqual(bashEmbeddedLanguageDocInfos)
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(newUri, 'python')).toEqual(pythonEmbeddedLanguageDocInfos)

    // Test deletion
    await embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(newUri)
    expect(fs.existsSync(bashEmbeddedLanguageDocPath)).toBeFalsy()
    expect(fs.existsSync(pythonEmbeddedLanguageDocPath)).toBeFalsy()
  })
})

describe('Create various basic embedded python documents', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
    await embeddedLanguageDocsManager.setStoragePath(__dirname)
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
    await embeddedLanguageDocsManager.setStoragePath(__dirname)
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
    ]
    /* // This is not yet supported by tree-sitter
    [
      'inside bash function',
      // eslint-disable-next-line no-template-curly-in-string
      'foo(){\necho ${@"bar"}\n}\n',
      '      \n       \n"bar"\n\n \n'
    ] */
  ])('%s', async (description, input, result) => {
    const embeddedContent = await createEmbeddedContent(input, 'python')
    expect(embeddedContent).toEqual(result)
  })
})

const createEmbeddedContent = async (content: string, language: EmbeddedLanguageType): Promise<string | undefined> => {
  const uri = randomUUID()
  const document = TextDocument.create(uri, 'bitbake', 1, content)
  analyzer.analyze({ document, uri })
  await generateEmbeddedLanguageDocs(document)
  const pythonEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(uri, language)
  if (pythonEmbeddedLanguageDocInfos === undefined) {
    return
  }
  const pythonEmbeddedLanguageDocPath = pythonEmbeddedLanguageDocInfos.uri.replace('file://', '')
  const embeddedContent = fs.readFileSync(pythonEmbeddedLanguageDocPath, 'utf8')
  void embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(uri)
  analyzer.resetAnalyzedDocuments()
  return embeddedContent
}

const expectedPythonEmbeddedLanguageDoc =
`${imports}                                    

def do_foo():
    print('123')
 

         
              
 
`

const expectedBashEmbeddedLanguageDoc =
`                                    

                
                
 

do_bar(){
    echo '123'
}
`
