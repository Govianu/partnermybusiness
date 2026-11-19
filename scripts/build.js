// npm run build: the website's pages, styles and scripts as static files for Apache/nginx (public_html).
//
// The pages call the Node API at /api (sign-in, dashboards, email, uploads, deals, lesson videos), so the API
// still runs on the server with PM2 (see ecosystem.config.js). The .htaccess written here forwards /api to it.
//
//   npm run build                                   -> ./dist
//   BUILD_OUT=/home/<user>/public_html npm run build -> straight into public_html (existing files there are kept,
//                                                      only this site's files are written or replaced)
// Settings (from .env or the shell): PORT (the API's port, default 3000), BUILD_OUT.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.resolve(ROOT, process.env.BUILD_OUT || 'dist');
const API_PORT = Number(process.env.PORT) || 3000;
const isDefaultOut = OUT === path.join(ROOT, 'dist');

if (OUT === SRC || OUT === ROOT) throw new Error(`BUILD_OUT must not be the project or its public folder (${OUT})`);

// Only ./dist is emptied first. A real public_html may hold other things (.well-known, cgi-bin, other sites).
if (isDefaultOut) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let files = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else { fs.copyFileSync(a, b); files += 1; }
  }
}
copyDir(SRC, OUT);

// The 100 business types, served by the Node server at /js/catalog.js; written as a file here
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'js', 'catalog.js'), 'window.PMB_CATALOG = ' + JSON.stringify(require('../utils/catalog').data) + ';\n');
files += 1;

// Apache: forward /api to the Node API (needs mod_rewrite, mod_proxy and mod_proxy_http).
// Kept between markers so a rebuild updates only this block in an existing .htaccess.
const BEGIN = '# BEGIN partnermybusiness';
const END = '# END partnermybusiness';
const block = `${BEGIN}
# Written by npm run build. The pages are static; everything under /api is answered by the Node API (PM2).
<IfModule mod_rewrite.c>
<IfModule mod_proxy.c>
  RewriteEngine On
  RewriteRule ^api/(.*)$ http://127.0.0.1:${API_PORT}/api/$1 [P,L,QSA]
</IfModule>
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.(html)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(css|js)$">
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
</IfModule>
${END}
`;
const htaccess = path.join(OUT, '.htaccess');
let existing = fs.existsSync(htaccess) ? fs.readFileSync(htaccess, 'utf8') : '';
const start = existing.indexOf(BEGIN), stop = existing.indexOf(END);
if (start !== -1 && stop !== -1) existing = existing.slice(0, start) + existing.slice(stop + END.length).replace(/^\r?\n/, '');
fs.writeFileSync(htaccess, block + (existing.trim() ? '\n' + existing : ''));
files += 1;

console.log(`Built ${files} files into ${OUT}`);
console.log(`/api is forwarded to http://127.0.0.1:${API_PORT} — keep the API running: pm2 start ecosystem.config.js`);
if (isDefaultOut) console.log('Copy everything in dist/ (including the hidden .htaccess) into public_html, e.g.  cp -a dist/. ~/public_html/');
