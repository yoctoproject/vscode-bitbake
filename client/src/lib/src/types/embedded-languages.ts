/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export type EmbeddedLanguageType = 'bash' | 'python'

export interface EmbeddedLanguageDoc {
  originalUri: string
  language: EmbeddedLanguageType
  content: string
  characterIndexes: number[]
}
