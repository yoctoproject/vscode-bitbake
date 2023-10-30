/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import axios from 'axios'

export function printHelloWorld (): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const response = axios.get('https://jsonplaceholder.typicode.com/posts/1') // Example URL
  console.log('Hello World!')
}
