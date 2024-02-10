/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const mergeArraysDistinctly = <ElementType, KeyType>(
  getKey: (a: ElementType) => KeyType, // A key on which two elements are equal
  ...arrays: ElementType[][]
): ElementType[] => {
  const mergedArray: ElementType[] = []
  const seenKeys = new Set<KeyType>()

  arrays.flat().forEach((item) => {
    const key = getKey(item)
    if (!seenKeys.has(key)) {
      mergedArray.push(item)
      seenKeys.add(key)
    }
  })

  return mergedArray
}
