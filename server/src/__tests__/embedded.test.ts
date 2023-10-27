/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

import { embeddedDocumentsManager } from '../embedded-languages/documents-manager'
import { generateEmbeddedDocuments, getEmbeddedDocumentUriStringOnPosition } from '../embedded-languages/general-support'
import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'

describe('Embedded Documents', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
    embeddedDocumentsManager.pathToBuildFolder = __dirname
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

    generateEmbeddedDocuments(FIXTURE_DOCUMENT.EMBEDDED)

    // Test embedded documents infos
    const bashEmbeddedDocumentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')
    if (bashEmbeddedDocumentInfos === undefined) {
      expect(bashEmbeddedDocumentInfos).not.toBeUndefined()
      return
    }
    expect(bashEmbeddedDocumentInfos.language).toEqual('bash')
    expect(bashEmbeddedDocumentInfos?.lineOffset).toEqual(0)

    const pythonEmbeddedDocumentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')
    if (pythonEmbeddedDocumentInfos === undefined) {
      expect(bashEmbeddedDocumentInfos).not.toBeUndefined()
      return
    }
    expect(pythonEmbeddedDocumentInfos?.language).toEqual('python')
    expect(pythonEmbeddedDocumentInfos?.lineOffset).toEqual(0)

    // Test embedded documents contents
    const bashEmbeddedDocumentPath = bashEmbeddedDocumentInfos.uri.replace('file://', '')
    const bashEmbeddedDocument = fs.readFileSync(bashEmbeddedDocumentPath, 'utf8')
    expect(bashEmbeddedDocument).toEqual(expectedBashEmbeddedDocument)

    const pythonEmbeddedDocumentPath = pythonEmbeddedDocumentInfos.uri.replace('file://', '')
    const pythonEmbeddedDocument = fs.readFileSync(pythonEmbeddedDocumentPath, 'utf8')
    expect(pythonEmbeddedDocument).toEqual(expectedPythonEmbeddedDocument)

    // Test returned embedded documents for positions
    const undefinedDocumentUri = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 0, character: 0 }
    )
    expect(undefinedDocumentUri).toBeUndefined()

    const bashEmbeddedDocumentUri = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 8, character: 0 }
    )
    expect(bashEmbeddedDocumentUri).toEqual(bashEmbeddedDocumentInfos.uri)

    const pythonEmbeddedDocumentUri = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 3, character: 0 }
    )
    expect(pythonEmbeddedDocumentUri).toEqual(pythonEmbeddedDocumentInfos.uri)

    // Test deletion
    embeddedDocumentsManager.deleteEmbeddedDocuments(FIXTURE_DOCUMENT.EMBEDDED.uri)
    expect(() => fs.readFileSync(bashEmbeddedDocumentPath)).toThrowError()
    expect(() => fs.readFileSync(pythonEmbeddedDocumentPath)).toThrowError()
  })
})

const expectedPythonEmbeddedDocument =
`                                    

def do_foo():
    print('123')
 

         
              
 
`

const expectedBashEmbeddedDocument =
`                                    

                
                
 

do_bar(){
    echo '123'
}
`
