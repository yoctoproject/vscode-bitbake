/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const mergeArraysDistinctly = <ElementType, KeyType>(
  array1: ElementType[],
  array2: ElementType[],
  getKey: (a: ElementType) => KeyType // A key on which two elements are equal
): ElementType[] => {
  const mergedArray: ElementType[] = []
  const seenKeys = new Set<KeyType>()

  array1.forEach((item) => {
    mergedArray.push(item)
    seenKeys.add(getKey(item))
  })

  array2.forEach((item) => {
    if (!seenKeys.has(getKey(item))) {
      mergedArray.push(item)
    }
  })

  return mergedArray
}
