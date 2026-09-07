const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "supabase/functions/**",
      "tests/**",
    ],
  },
  { rules: { "@typescript-eslint/no-explicit-any": "off" } },
]);
