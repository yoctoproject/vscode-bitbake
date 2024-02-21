/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type ParsedPath } from 'path'
export interface LayerInfo {
  name: string
  path: string
  priority: number
}

export interface PathInfo extends ParsedPath {}

export interface ElementInfo {
  name: string
  extraInfo?: string
  path?: PathInfo
  layerInfo?: LayerInfo
  appends?: PathInfo[]
  overlayes?: PathInfo[]
  version?: string
}

export interface DevtoolWorkspaceInfo {
  name: string
  path: string
}

export interface BitbakeScanResult {
  _layers: LayerInfo[]
  _classes: ElementInfo[]
  _includes: ElementInfo[]
  _recipes: ElementInfo[]
  _overrides: string[]
  _confFiles: ElementInfo[]
  _workspaces: DevtoolWorkspaceInfo[]
}

export function scanContainsData (scanResult: BitbakeScanResult): boolean {
  return scanResult._layers.length > 0 || scanResult._recipes.length > 0 || scanResult._workspaces.length > 0
}

export function scanContainsRecipes (scanResult: BitbakeScanResult): boolean {
  return scanResult._layers.length > 0 || scanResult._recipes.length > 0
}

export function pathInfoToString (pathInfo: PathInfo): string {
  return `${pathInfo.dir}/${pathInfo.base}`
}
