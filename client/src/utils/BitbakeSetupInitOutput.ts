/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

const initializationMarkers = [
  'Initializing a setup directory in',
  'Setup already initialized in:'
]

export function parseBitbakeSetupInitializedDirectory (
  output: string
): string | undefined {
  const normalized = output.replace(/\r\n/g, '\n')

  for (const marker of initializationMarkers) {
    const markerIndex = normalized.lastIndexOf(marker)

    if (markerIndex === -1) {
      continue
    }

    const afterMarker = normalized.slice(
      markerIndex + marker.length
    )

    const firstLine = afterMarker
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0)

    if (firstLine !== undefined) {
      return firstLine
    }
  }

  return undefined
}
