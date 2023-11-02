/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export type EmbeddedLanguageType = 'bash' | 'python'

export interface EmbeddedLanguageDocInfos {
  uri: string
  language: EmbeddedLanguageType
  lineOffset: number
}
