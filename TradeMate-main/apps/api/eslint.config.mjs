import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Type correctness is enforced separately by the API TypeScript build.
      // Keep this config focused on static correctness and maintainable patterns.
    },
  },
);
