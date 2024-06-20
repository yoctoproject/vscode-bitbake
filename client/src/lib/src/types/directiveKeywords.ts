/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const DIRECTIVE_STATEMENT_KEYWORDS = ['require', 'inherit', 'include', 'inherit_defer'] as const

export type DirectiveStatementKeyword = typeof DIRECTIVE_STATEMENT_KEYWORDS[number]

export const checkIsDirectiveStatementKeyword = (keyword: unknown): keyword is DirectiveStatementKeyword => {
  return (DIRECTIVE_STATEMENT_KEYWORDS as readonly unknown[]).includes(keyword)
}
