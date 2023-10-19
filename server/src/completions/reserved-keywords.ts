/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

const BITBAKE_KEYWORDS = [
  'python',
  'def',
  'include',
  'import',
  'require',
  'inherit',
  'addtask',
  'deltask',
  'after',
  'before',
  'export',
  'fakeroot',
  'EXPORT_FUNCTIONS',
  'INHERIT'
]

const PYTHON_KEYWORDS = [
  'def',
  'from',
  'import',
  'if',
  'else',
  'return',
  'or',
  'elif',
  'for',
  'while',
  'break',
  'continue',
  'yield',
  'try',
  'except',
  'finally',
  'raise',
  'assert',
  'as',
  'pass',
  'del',
  'with',
  'async',
  'await'
]

const SHELL_KEYWORDS = [
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'case',
  'esac',
  'for',
  'while',
  'until',
  'do',
  'done',
  'in',
  'function',
  'select',
  'time',
  'coproc',
  'break',
  'continue',
  'return',
  'exit',
  'unset',
  'export',
  'readonly',
  'declare',
  'local',
  'eval',
  'exec',
  'trap'
]

export const RESERVED_KEYWORDS = [...new Set([
  ...BITBAKE_KEYWORDS,
  ...PYTHON_KEYWORDS,
  ...SHELL_KEYWORDS
])]
