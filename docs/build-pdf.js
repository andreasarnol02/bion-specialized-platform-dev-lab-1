#!/usr/bin/env node
/**
 * Membuat PDF dari docs/TP2_Dokumentasi.md untuk dikumpulkan.
 *
 * Nilai pribadi (nama, NIM, kredensial akun demo) tidak disimpan pada berkas
 * markdown yang ter-commit. Nilainya diambil dari docs/identitas.local.json
 * yang masuk .gitignore, lalu disisipkan ke placeholder {{...}} saat build.
 * PDF hasilnya juga tidak ikut ter-commit.
 *
 * Pemakaian:
 *   cd docs && npm install marked && node build-pdf.js
 *
 * Butuh wkhtmltopdf:
 *   brew install --cask wkhtmltopdf
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { marked } = require("marked");

const DOCS_DIR = __dirname;
const SOURCE = path.join(DOCS_DIR, "TP2_Dokumentasi.md");
const VALUES = path.join(DOCS_DIR, "identitas.local.json");
const HTML_OUT = path.join(DOCS_DIR, "TP2_Dokumentasi.local.html");
const PDF_OUT = path.join(DOCS_DIR, "TP2_Dokumentasi.pdf");

if (!fs.existsSync(VALUES)) {
  console.error(`Tidak menemukan ${path.basename(VALUES)}.`);
  console.error("Salin dari identitas.local.example.json lalu isi nilainya.");
  process.exit(1);
}

const values = JSON.parse(fs.readFileSync(VALUES, "utf8"));
let markdown = fs.readFileSync(SOURCE, "utf8");

// Buang komentar HTML penjelasan template supaya tidak ikut ke PDF.
markdown = markdown.replace(/<!--[\s\S]*?-->\s*/g, "");

for (const [key, value] of Object.entries(values)) {
  markdown = markdown.split(`{{${key}}}`).join(value);
}

const unresolved = markdown.match(/\{\{[A-Z_]+\}\}/g);

if (unresolved) {
  console.error("Placeholder belum terisi:", [...new Set(unresolved)].join(", "));
  console.error(`Tambahkan kuncinya ke ${path.basename(VALUES)}.`);
  process.exit(1);
}

const remaining = markdown.match(/«[^»]*»/g);

if (remaining) {
  console.warn(`Masih ada ${remaining.length} penanda screenshot yang belum diisi:`);
  remaining.forEach((item) => console.warn("  " + item));
  console.warn("");
}

const body = marked(markdown);

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Dokumentasi TP2 — Toko Arnol</title>
<style>
  @page { margin: 18mm 16mm; }
  body {
    font: 10.5pt/1.6 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    max-width: 100%;
  }
  h1 { font-size: 21pt; margin: 0 0 4pt; border-bottom: 2px solid #0c6b4e; padding-bottom: 6pt; }
  h2 { font-size: 15pt; margin: 22pt 0 7pt; color: #0c6b4e; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 15pt 0 5pt; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  table { border-collapse: collapse; width: 100%; margin: 9pt 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d5d5d5; padding: 5pt 8pt; text-align: left; vertical-align: top; }
  th { background: #eef4f2; font-weight: 600; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 9pt; background: #f2f2f0; padding: 1pt 3pt; border-radius: 2px; }
  pre { background: #f7f7f5; border: 1px solid #e2e2de; border-radius: 4px; padding: 8pt 10pt; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.5pt; line-height: 1.45; }
  img { max-width: 100%; border: 1px solid #d5d5d5; border-radius: 3px; margin: 6pt 0; page-break-inside: avoid; }
  blockquote { border-left: 3px solid #b45309; background: #fdf6ec; margin: 9pt 0; padding: 6pt 12pt; color: #5a4a32; }
  hr { border: none; border-top: 1px solid #d5d5d5; margin: 18pt 0; }
  a { color: #0c6b4e; word-break: break-all; }
  strong { font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(HTML_OUT, html);

execFileSync(
  "wkhtmltopdf",
  [
    "--enable-local-file-access",
    "--print-media-type",
    "--footer-right", "[page] / [topage]",
    "--footer-font-size", "8",
    "--footer-spacing", "6",
    HTML_OUT,
    PDF_OUT,
  ],
  { stdio: ["ignore", "ignore", "inherit"] }
);

fs.unlinkSync(HTML_OUT);

const sizeKb = Math.round(fs.statSync(PDF_OUT).size / 1024);
console.log(`PDF dibuat: ${path.relative(process.cwd(), PDF_OUT)} (${sizeKb} KB)`);
