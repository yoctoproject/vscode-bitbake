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
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
