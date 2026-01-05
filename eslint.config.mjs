import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  { ignores: ["**/dist/**", "dist/", "coverage/"] },
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
      rules: {
          "@typescript-eslint/no-explicit-any": "warn",
          "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
      }
  }
];
