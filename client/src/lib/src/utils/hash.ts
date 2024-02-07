/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as crypto from 'crypto'

export const hashString = (text: string, length: number = 32): string => {
  const hash = crypto.createHash('sha256')
  return hash.update(text).digest('hex').slice(0, length)
}
