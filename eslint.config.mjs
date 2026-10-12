import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });
export default [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "scratch/**", "CloneIntegrate/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Existing database mapping boundaries remain untyped; tightening them is incremental.
  { rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": "warn" } },
];
