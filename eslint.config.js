import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default tseslint.config(...tseslint.configs.recommended, {
  files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
  languageOptions: {
    globals: { ...globals.browser, ...globals.worker, ...globals.node },
  },
  plugins: { "react-hooks": hooks },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
});
