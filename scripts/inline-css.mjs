// Deploy step (.github/workflows/static.yml), run on the copy that is uploaded, never committed back:
// the site's own stylesheets are written into each page, so the first paint does not wait for two more
// requests, and the comments in its CSS and HTML are left out of what visitors download.
// The source stays as it is: pages keep their <link>s, so they still work served straight from the repo.
// Usage: node scripts/inline-css.mjs [page.html ...]   (defaults to the site's pages)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html', 'privacy.html', 'terms.html'];

// Conservative: comments out, runs of whitespace to one space, no spaces around { } ; .
// Nothing that could change a selector (a space before ":" is a descendant combinator) or a string.
const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};])\s*/g, '$1')
  .trim();

for (const page of pages) {
  let html = readFileSync(page, 'utf8');
  const before = html.length;
  // Local stylesheets only (not Google Fonts), and only ones that block rendering (no media="print" trick)
  html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+\.css)">/g, (tag, href) => {
    const css = readFileSync(join(dirname(page), href), 'utf8');
    if (/url\(/.test(css)) return tag;   // relative url()s would point elsewhere once moved into the page
    return `<style>${minifyCss(css)}</style>`;
  });
  html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${minifyCss(css)}</style>`);
  html = html.replace(/<!--(?!\[)[\s\S]*?-->\s*/g, '');   // HTML comments
  writeFileSync(page, html);
  console.log(`${page}: ${before} -> ${html.length} bytes`);
}
