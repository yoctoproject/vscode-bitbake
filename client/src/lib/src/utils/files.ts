/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

export function extractRecipeName (filePath: string | undefined): string | undefined {
  if (filePath === undefined) { return undefined }
  return path.parse(filePath).name.split('_')[0]
}
