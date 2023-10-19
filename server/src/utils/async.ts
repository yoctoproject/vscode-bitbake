/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

/**
 * A collection of async utilities.
 * If we ever need to add anything fancy, then https://github.com/vscode-shellcheck/vscode-shellcheck/blob/master/src/utils/async.ts
 * is a good place to look.
 */
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * Debounce a function call by a given amount of time. Only the last call
 * will be resolved.
 * Inspired by https://gist.github.com/ca0v/73a31f57b397606c9813472f7493a940
 */
export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitForMs: number
): (...args: Parameters<F>) => Promise<UnwrapPromise<ReturnType<F>>> => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return async (...args: Parameters<F>): Promise<UnwrapPromise<ReturnType<F>>> =>
    await new Promise((resolve) => {
      if (timeout !== null) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => { resolve(func(...args)) }, waitForMs)
    })
}
