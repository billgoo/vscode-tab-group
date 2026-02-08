const {
    defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const prettier = require("eslint-plugin-prettier");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
    },

    plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
    },

    extends: compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"),

    rules: {
        "prettier/prettier": "error",

        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
        }],

        "@typescript-eslint/no-explicit-any": "off",
    },
}]);