/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fg from 'fast-glob'
import vscode from 'vscode'
import { logger } from '../lib/src/utils/OutputLogger'

type GlobStream =
  NodeJS.ReadableStream &
  AsyncIterable<fg.Entry> & {
    destroy: () => void
  }

export class CancellableFileSearch {
  public static async findFilesAndDirs (
    patterns: string[],
    maxFileResults?: number,
    token?: vscode.CancellationToken
  ): Promise<{
      foundFiles: vscode.Uri[]
      foundDirs: string[]
    }> {
    const foundFiles: vscode.Uri[] = []
    const foundDirs: string[] = []

    const isCancelled = (): boolean => {
      return token?.isCancellationRequested === true
    }

    if (patterns.length === 0 || isCancelled()) {
      return { foundFiles, foundDirs }
    }

    const stream = fg.stream(patterns, {
      absolute: true,
      concurrency: 4,
      dot: true,
      followSymbolicLinks: false,
      objectMode: true,
      onlyFiles: false,
      unique: true
    }) as GlobStream

    let streamDestroyed = false

    const destroyStream = (): void => {
      if (streamDestroyed) {
        return
      }

      streamDestroyed = true
      stream.destroy()
    }

    const cancellationSubscription =
      typeof token?.onCancellationRequested === 'function'
        ? token.onCancellationRequested(() => {
          destroyStream()
        })
        : undefined

    try {
      for await (const entry of stream) {
        if (isCancelled()) {
          destroyStream()
          break
        }

        if (entry.dirent.isDirectory()) {
          foundDirs.push(entry.path)
          continue
        }

        if (
          entry.dirent.isFile() &&
          (
            maxFileResults === undefined ||
            foundFiles.length < maxFileResults
          )
        ) {
          foundFiles.push(vscode.Uri.file(entry.path))
        }
      }
    } catch (error) {
      logger.error(
        `An error occurred while searching files and directories. ${
          JSON.stringify(error)
        }`
      )
    } finally {
      destroyStream()
      cancellationSubscription?.dispose()
    }

    return { foundFiles, foundDirs }
  }
}
