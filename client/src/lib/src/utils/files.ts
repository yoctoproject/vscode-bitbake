/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

import { logger } from './OutputLogger'

export const getFileContent = async (path: string): Promise<string | undefined> => {
  const fileContent = await new Promise<string>((resolve, reject) => {
    fs.readFile(path, { encoding: 'utf-8' },
      (error, data) => { error !== null ? reject(error) : resolve(data) }
    )
  }).catch(err => {
    logger.error(`Could not open file: ${err}`)
    return undefined
  })
  return fileContent
}
