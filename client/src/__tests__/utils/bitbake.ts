/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'

// This is similar to the integration-tests addLayer() but doesn't use the VSCode API
export function addLayer (layer: string, buildFolder: string): void {
  const bblayersConf = path.resolve(buildFolder, 'conf/bblayers.conf')
  const bblayersConfContent = fs.readFileSync(bblayersConf)
  let fileContent = bblayersConfContent.toString()
  fileContent += `\nBBLAYERS+="${layer}"\n`
  fs.writeFileSync(bblayersConf, fileContent)
}

// This is similar to the integration-tests removeLayer() but doesn't use the VSCode API
export function removeLayer (layer: string, buildFolder: string): void {
  const bblayersConf = path.resolve(buildFolder, 'conf/bblayers.conf')
  const bblayersConfContent = fs.readFileSync(bblayersConf)
  let fileContent = bblayersConfContent.toString()
  fileContent = fileContent.replace(`\nBBLAYERS+="${layer}"`, '')
  fs.writeFileSync(bblayersConf, fileContent)
}
