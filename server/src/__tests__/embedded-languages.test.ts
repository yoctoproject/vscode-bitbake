/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

import { embeddedLanguageDocsManager } from '../embedded-languages/documents-manager'
import { generateEmbeddedLanguageDocs, getEmbeddedLanguageDocInfosOnPosition } from '../embedded-languages/general-support'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'

describe('Embedded Language Documents', () => {
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

  it('generate and delete embedded documents for bash and python', async () => {
    // Setup
    await analyzer.analyze({
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

describe('Create embedded language content for inline Python', () => {
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

  afterEach(async () => {
    await embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs('dummy')
  })

  test.each([
    [
      'with single quotes',
      // eslint-disable-next-line no-template-curly-in-string
      "FOO = '${@\"BAR\"}'\n",
      "import bb\nFOO = f'''{\"BAR\"}'''\n"
    ],
    [
      'with double quotes',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = "${@\'BAR\'}"\n',
      'import bb\nFOO = f"""{\'BAR\'}"""\n'
    ],
    [
      'with bitbake operator',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO ??= "${@\'BAR\'}"\n',
      'import bb\nFOO = f"""{\'BAR\'}"""\n'
    ],
    [
      'with complex spacing',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO  ?=   "  BAR  ${@  \'BAR\'   }  BAR  "\n',
      'import bb\nFOO  =   f"""  BAR  {  \'BAR\'   }  BAR  """\n'
    ],
    [
      'multiline',
      // eslint-disable-next-line no-template-curly-in-string
      'FOO = "${@\'BAR\'} \\\n1 \\\n2"\n',
      'import bb\nFOO = f"""{\'BAR\'} \n1 \n2"""\n'
    ]
  ])('%s', async (description, input, result) => {
    const embeddedContent = await createEmbeddedContent(input, 'python')
    expect(embeddedContent).toEqual(result)
  })
})

const createEmbeddedContent = async (content: string, language: EmbeddedLanguageType): Promise<string | undefined> => {
  const uri = 'dummmy'
  const document = TextDocument.create(uri, 'bb', 1, content)
  await analyzer.analyze({ document, uri })
  await generateEmbeddedLanguageDocs(document)
  const pythonEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(uri, 'python')
  if (pythonEmbeddedLanguageDocInfos === undefined) {
    return
  }
  const pythonEmbeddedLanguageDocPath = pythonEmbeddedLanguageDocInfos.uri.replace('file://', '')
  return fs.readFileSync(pythonEmbeddedLanguageDocPath, 'utf8')
}

const expectedPythonEmbeddedLanguageDoc =
`import bb
                                    

def do_foo():
    print('123')
 

         
              
 
`

const expectedBashEmbeddedLanguageDoc =
`                                    

                
                
 

do_bar(){
    echo '123'
}
`
