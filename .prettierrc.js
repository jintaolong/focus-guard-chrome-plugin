module.exports = {
  plugins: [require("@plasmohq/prettier-plugin-sort-imports")],
  importOrder: [
    "^plasmo(.*)$",
    "^react(.*)$",
    "^@plasmohq/(.*)$",
    "^~(.*)$",
    "^[./]"
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true
}
