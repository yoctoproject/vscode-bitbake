import header from "eslint-plugin-header";
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {
    ignores: [
      "**/out",
      "**/poky",
      "**/.vscode-test",
      "__mocks__/vscode.ts",
      "**/jest.config.js",
      "**/eslint.config.mjs",
    ],
  },
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {
    plugins: {
      header,
    },
    languageOptions: { globals: globals.browser },
    rules: {
      "header/header": [
        2,
        "block",
        [
          " --------------------------------------------------------------------------------------------",
          {
            pattern: " \\* Copyright \\(c\\) .*\\. All rights reserved\\.",
            template:
              " * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.",
          },
          " * Licensed under the MIT License. See License.txt in the project root for license information.",
          " * ------------------------------------------------------------------------------------------ ",
        ],
        2,
      ],
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
