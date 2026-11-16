import { readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";

const [html, css, js] = await Promise.all(
  ["index.html", "style.css", "main.js"].map((file) => readFile(file, "utf8")),
);
const [styles, script] = await Promise.all([
  transform(css, { loader: "css", minify: true }),
  transform(js, { loader: "js", minify: true }),
]);

// The site has one page. Send its CSS with the HTML to avoid waiting for
// a second response before rendering. Keep the source files usable directly.
const stylesheet = '<link rel="stylesheet" href="style.css" />';
if (!html.includes(stylesheet)) throw new Error("Missing style.css link");
await Promise.all([
  writeFile("dist/index.html", html.replace(stylesheet, () => `<style>${styles.code.trim()}</style>`)),
  writeFile("dist/main.js", script.code),
]);
