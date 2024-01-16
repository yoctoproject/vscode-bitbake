/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { IndentAction, type LanguageConfiguration } from 'vscode'
import { verboseRegExp } from '../lib/src/utils/regexp'

export function getLanguageConfiguration (): LanguageConfiguration {
  return {
    // These rules are from vscode-python extension. We assume Python rules won't interfere into bash code or regular BitBake code.
    // The comments are also from vscode-python, and refer to issues on its repository.
    // https://github.com/microsoft/vscode-python/blob/63cf2633919f694bf62e104129f050f8a0a3f85b/src/client/language/languageConfiguration.ts
    onEnterRules: [
      // multi-line separator
      {
        beforeText: verboseRegExp(`
          ^
          (?! \\s+ \\\\ )
          [^#\n]+
          \\\\
          $
        `),
        action: {
          indentAction: IndentAction.Indent
        }
      },
      // continue comments
      {
        beforeText: /^\s*#.*/,
        afterText: /.+$/,
        action: {
          indentAction: IndentAction.None,
          appendText: '# '
        }
      },
      // indent on enter (block-beginning statements)
      {
        /**
             * This does not handle all cases. However, it does handle nearly all usage.
             * Here's what it does not cover:
             * - the statement is split over multiple lines (and hence the ":" is on a different line)
             * - the code block is inlined (after the ":")
             * - there are multiple statements on the line (separated by semicolons)
             * Also note that `lambda` is purposefully excluded.
             */
        beforeText: verboseRegExp(`
          ^
          \\s*
          (?:
            (?:
              (?:
                class |
                def |
                async \\s+ def |
                except |
                for |
                async \\s+ for |
                if |
                elif |
                while |
                with |
                async \\s+ with |
                match |
                case
              )
              \\b .*
            ) |
            else |
            try |
            finally
          )
          \\s*
          [:]
          \\s*
          (?: [#] .* )?
          $
        `),
        action: {
          indentAction: IndentAction.Indent
        }
      },
      // outdent on enter (block-ending statements)
      {
        /**
             * This does not handle all cases. Notable omissions here are
             * "return" and "raise" which are complicated by the need to
             * only outdent when the cursor is at the end of an expression
             * rather than, say, between the parentheses of a tail-call or
             * exception construction. (see issue #10583)
             */
        beforeText: verboseRegExp(`
          ^
          (?:
            (?:
              \\s*
              (?:
                pass
              )
            ) |
            (?:
              \\s+
              (?:
                raise |
                break |
                continue
              )
            )
          )
          \\s*
          (?: [#] .* )?
          $
        `),
        action: {
          indentAction: IndentAction.Outdent
        }
      }
      // Note that we do not currently have an auto-dedent
      // solution for "elif", "else", "except", and "finally".
      // We had one but had to remove it (see issue #6886).
    ]
  }
}
