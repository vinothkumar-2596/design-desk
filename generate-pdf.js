const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const md = fs.readFileSync('Design-Desk-Features-Report.md', 'utf-8');

// Simple markdown to HTML converter
function mdToHtml(md) {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n)+/g, (t) => {
      const rows = t.trim().split('\n');
      const header = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
      const body = rows.slice(2).join('\n'); // skip separator row
      return `<table><thead>${header}</thead><tbody>${body}</tbody></table>\n`;
    })
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hult]|<\/[hult]|<hr|<table|<\/table|<thead|<\/thead|<tbody|<\/tbody|<tr|<\/tr)(.+)$/gm, '<p>$1</p>');
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Design Desk Features Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px 50px; line-height: 1.6; }
  h1 { font-size: 26px; color: #1e3a5f; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; margin: 30px 0 15px; }
  h2 { font-size: 19px; color: #2563eb; border-left: 4px solid #2563eb; padding-left: 10px; margin: 25px 0 12px; }
  h3 { font-size: 15px; color: #374151; margin: 18px 0 8px; }
  p { margin: 6px 0; }
  ul { margin: 6px 0 6px 20px; }
  li { margin: 3px 0; }
  code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; color: #c0392b; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  th { background: #1e3a5f; color: white; padding: 8px 10px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  strong { font-weight: 600; }
  .cover { text-align: center; padding: 60px 0 40px; border-bottom: 2px solid #1e3a5f; margin-bottom: 30px; }
  .cover h1 { border: none; font-size: 32px; }
  .cover .sub { color: #6b7280; margin-top: 8px; font-size: 14px; }
</style>
</head>
<body>
<div class="cover">
  <h1>Design Desk</h1>
  <div class="sub">Features Report — Generated 2026-03-13</div>
  <div class="sub">Design Request Management System</div>
</div>
${mdToHtml(md)}
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: 'Design-Desk-Features-Report.pdf',
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true
  });
  await browser.close();
  console.log('PDF generated: Design-Desk-Features-Report.pdf');
})();
