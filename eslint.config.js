// ESLint configuration for TypeScript projects (ESLint v9+)
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export const eslintConfig = [
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.json",
				sourceType: "module",
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		linterOptions: {
			reportUnusedDisableDirectives: true,
		},
	},
	js.configs.recommended,
];
