/** @type {import("prettier").Options} */
module.exports = {
  $schema: "http://json.schemastore.org/prettierrc",
  arrowParens: "always",
  bracketSameLine: false,
  bracketSpacing: true,
  htmlWhitespaceSensitivity: "css",
  printWidth: 80,
  proseWrap: "never",
  quoteProps: "consistent",
  semi: false,
  tabWidth: 2,
  trailingComma: "all",
  overrides: [
    {
      files: "*.css",
      options: {
        printWidth: 120,
      },
    },
  ],
}
