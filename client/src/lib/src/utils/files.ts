/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import path from 'path'
import { logger } from './OutputLogger'

export const bitbakeFileExtensions = ['.bb', '.bbappend', '.bbclass', '.conf', '.inc']

export function extractRecipeName (filePath: string): string {
  // Ex: gst1.0-plugins-bad_1.18.4.bb -> gst1.0-plugins-bad
  const fileName = extractRecipeFileName(filePath)
  const recipeName = fileName.split('_')[0]
  return recipeName
}

export function extractRecipeVersion (filePath: string): string {
  // Ex: gst1.0-plugins-bad_1.18.4.bb -> 1.18.4
  const fileName = extractRecipeFileName(filePath)
  const version = fileName.split('_')[1]
  return version
}

function extractRecipeFileName (filePath: string): string {
  // Ex: gst1.0-plugins-bad_1.18.4.bb -> gst1.0-plugins-bad_1.18.4
  const FileName = path.parse(filePath).base
  const stringRegex = '(' + bitbakeFileExtensions.map(ext => `\\${ext}`).join('|') + ')$'
  const fileName = FileName.replace(new RegExp(stringRegex, 'g'), '')
  return fileName
}

export async function loadFileContent (filePath: string): Promise<string | undefined> {
  return await new Promise((resolve) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err !== null) {
        logger.info(`[loadFileContent]: Failed to load ${filePath}`)
        resolve(undefined)
      } else {
        resolve(data)
      }
    })
  })
}
