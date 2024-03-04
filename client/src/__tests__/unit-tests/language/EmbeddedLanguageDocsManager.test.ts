/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { embeddedLanguageDocsManager } from '../../../language/EmbeddedLanguageDocsManager'

describe('EmbeddedLanguageDocsManager', () => {
  it('can create and delete embedded language documents folder', async () => {
    const storagePath = path.join(__dirname, 'generated-content')
    await embeddedLanguageDocsManager.setStoragePath(storagePath)
    expect(embeddedLanguageDocsManager.embeddedLanguageDocsFolder).toBeDefined()
    if (embeddedLanguageDocsManager.embeddedLanguageDocsFolder === undefined) {
      return
    }
    expect(fs.existsSync(embeddedLanguageDocsManager.embeddedLanguageDocsFolder)).toBeTruthy()
    await embeddedLanguageDocsManager.deleteEmbeddedLanguageDocsFolder()
    expect(fs.existsSync(embeddedLanguageDocsManager.embeddedLanguageDocsFolder)).toBeFalsy()
  })
})
