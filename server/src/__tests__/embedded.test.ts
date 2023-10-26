/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'

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
    embeddedDocumentsManager.workspaceFolder = __dirname
    embeddedDocumentsManager.pathToBuildFolder = __dirname
  })

  beforeEach(() => {
    analyzer.resetAnalyzedDocuments()
  })

  it('generate and delete embedded documents for bash and python', async () => {
    await analyzer.analyze({
      uri: FIXTURE_DOCUMENT.EMBEDDED.uri,
      document: FIXTURE_DOCUMENT.EMBEDDED
    })

    generateEmbeddedDocuments(FIXTURE_DOCUMENT.EMBEDDED)

    const bashEmbeddedDocumentPath = path.join(__dirname, '/embedded-documents/fixtures/embedded.bb.sh')
    const bashEmbeddedDocumentUri = `file://${bashEmbeddedDocumentPath}`
    const pythonEmbeddedDocumentPath = path.join(__dirname, '/embedded-documents/fixtures/embedded.bb.py')
    const pythonEmbeddedDocumentUri = `file://${pythonEmbeddedDocumentPath}`

    const bashEmbeddedDocumentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'bash')
    expect(bashEmbeddedDocumentInfos).toEqual({
      uri: bashEmbeddedDocumentUri,
      language: 'bash',
      lineOffset: 0
    })

    const pythonEmbeddedDocumentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(FIXTURE_DOCUMENT.EMBEDDED.uri, 'python')
    expect(pythonEmbeddedDocumentInfos).toEqual({
      uri: pythonEmbeddedDocumentUri,
      language: 'python',
      lineOffset: 0
    })

    const pythonEmbeddedDocument = fs.readFileSync(pythonEmbeddedDocumentPath, 'utf8')
    expect(pythonEmbeddedDocument).toEqual(expectedPythonEmbeddedDocument)

    const bashEmbeddedDocument = fs.readFileSync(bashEmbeddedDocumentPath, 'utf8')
    expect(bashEmbeddedDocument).toEqual(expectedBashEmbeddedDocument)

    const undefinedDocumentInfos = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 0, character: 0 }
    )
    expect(undefinedDocumentInfos).toBeUndefined()

    const sameBashEmbeddedDocumentUri = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 8, character: 0 }
    )
    expect(sameBashEmbeddedDocumentUri).toEqual(bashEmbeddedDocumentUri)

    const samePythonEmbeddedDocumentUri = getEmbeddedDocumentUriStringOnPosition(
      FIXTURE_DOCUMENT.EMBEDDED.uri,
      { line: 3, character: 0 }
    )
    expect(samePythonEmbeddedDocumentUri).toEqual(pythonEmbeddedDocumentUri)

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
