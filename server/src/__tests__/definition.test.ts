/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { analyzer } from '../tree-sitter/analyzer'
import { generateParser } from '../tree-sitter/parser'
import { onDefinitionHandler } from '../connectionHandlers/onDefinition'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { type Location } from 'vscode-languageserver'
import { definitionProvider } from '../DefinitionProvider'
// TODO: Current implementation of the definitionProvider needs to be improved, this test suite should be modified accordingly after
const mockDefinition = (path: string | undefined): void => {
  if (path !== undefined) {
    const location: Location = { uri: 'file://' + path, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }

    jest.spyOn(definitionProvider, 'createDefinitionForKeyword').mockReturnValue(location)
  } else {
    jest.spyOn(definitionProvider, 'createDefinitionForKeyword').mockReturnValue([])
  }
}

const DUMMY_URI = 'dummy_uri'
describe('on definition', () => {
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

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('provides definition to directive statement', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.DEFINITION
    })

    let position = {
      line: 0,
      character: 9
    }

    mockDefinition(analyzer.getDocumentTexts(DUMMY_URI)?.[position.line].split(' ')[1])

    const definition1 = onDefinitionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position
    })

    expect(definition1).toEqual(
      {
        uri: 'file://dummy',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 }
        }
      }
    )

    position = {
      line: 0,
      character: 0
    }

    mockDefinition(analyzer.getDocumentTexts(DUMMY_URI)?.[position.line].split(' ')[1])

    const definition2 = onDefinitionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position
    })

    expect(definition2).toEqual([])
  })
})
