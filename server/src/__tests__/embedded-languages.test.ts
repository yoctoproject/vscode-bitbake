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

describe('Embedded Language Documents', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
    embeddedLanguageDocsManager.storagePath = __dirname
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

    generateEmbeddedLanguageDocs(FIXTURE_DOCUMENT.EMBEDDED)

    // Test embedded documents infos
    const bashEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')
    if (bashEmbeddedLanguageDocInfos === undefined) {
      expect(bashEmbeddedLanguageDocInfos).not.toBeUndefined()
      return
    }
    expect(bashEmbeddedLanguageDocInfos.language).toEqual('bash')
    expect(bashEmbeddedLanguageDocInfos?.lineOffset).toEqual(0)

    const pythonEmbeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')
    if (pythonEmbeddedLanguageDocInfos === undefined) {
      expect(bashEmbeddedLanguageDocInfos).not.toBeUndefined()
      return
    }
    expect(pythonEmbeddedLanguageDocInfos?.language).toEqual('python')
    expect(pythonEmbeddedLanguageDocInfos?.lineOffset).toEqual(1)

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

    // Test moving embedded documents
    const newUri = 'dummy'
    embeddedLanguageDocsManager.moveEmbeddedLanguageDocs(FIXTURE_DOCUMENT.EMBEDDED.uri, newUri)
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')).toBeUndefined()
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')).toBeUndefined()
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(newUri, 'bash')).toEqual(bashEmbeddedLanguageDocInfos)
    expect(embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(newUri, 'python')).toEqual(pythonEmbeddedLanguageDocInfos)

    // Test deletion
    embeddedLanguageDocsManager.deleteEmbeddedLanguageDocs(newUri)
    expect(() => fs.readFileSync(bashEmbeddedLanguageDocPath)).toThrow()
    expect(() => fs.readFileSync(pythonEmbeddedLanguageDocPath)).toThrow()
  })
})

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
