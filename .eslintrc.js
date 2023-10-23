module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'standard-with-typescript',
    'plugin:deprecation/recommended'
  ],
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        '*.ts'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['header'],
  rules: {
    "header/header": [2, "block", [
      " --------------------------------------------------------------------------------------------",
      {"pattern": " \\* Copyright \\(c\\) .*\\. All rights reserved\\.", "template": " * Copyright (c) 2023 Savoir-faire Linux. All rights reserved."},
      " * Licensed under the MIT License. See License.txt in the project root for license information.",
      " * ------------------------------------------------------------------------------------------ ",
    ], 2]
  },
  ignorePatterns: [
    'out',
    'poky',
    '__mocks__/vscode.ts'
  ],
}
