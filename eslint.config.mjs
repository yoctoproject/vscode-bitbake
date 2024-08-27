import header from "eslint-plugin-header";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

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
  ...compat.extends(
    "standard-with-typescript",
    "plugin:deprecation/recommended"
  ),
  {
    plugins: {
      header,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
      },

      ecmaVersion: "latest",
      sourceType: "module",
    },

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
  {
    files: ["**/*.ts"],

    languageOptions: {
      globals: {
        ...globals.node,
      },

      ecmaVersion: 5,
      sourceType: "commonjs",
    },
  },
];
