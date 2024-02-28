/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

export const bitbakeFileExtensions = ['.bb', '.bbappend', '.bbclass', '.conf', '.inc']

export function extractRecipeName (filePath: string): string {
  // Ex: gst1.0-plugins-bad_1.18.4.bb -> gst1.0-plugins-bad
  const baseName = path.parse(filePath).base
  const stringRegex = '(' + bitbakeFileExtensions.map(ext => `\\${ext}`).join('|') + ')$'
  const fileName = baseName.replace(new RegExp(stringRegex, 'g'), '')
  const recipeName = fileName.split('_')[0]
  return recipeName
}
