/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

export function extractRecipeName (filename: string | undefined): string | undefined {
  if (filename === undefined) { return undefined }
  return path.basename(filename).split('.')[0].split('_')[0]
}
