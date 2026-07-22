import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".expo/**",
      "babel.config.js",
      "metro.config.js",
    ],
  },
  ...tseslint.configs.recommended,
);
