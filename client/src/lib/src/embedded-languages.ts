/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { hashString } from './utils/hash'

export type EmbeddedLanguageType = 'bash' | 'python'

export interface EmbeddedLanguageDoc {
  originalUri: string
  language: EmbeddedLanguageType
  content: string
  characterIndexes: number[]
}

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
}

export const getEmbeddedLanguageDocFilename = (uri: string, languageType: EmbeddedLanguageType): string => {
  const hashedName = hashString(uri)
  const fileExtension = fileExtensionsMap[languageType]
  return hashedName + fileExtension
}
