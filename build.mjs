/**
 * Baut imperWARtor zu einer einzigen HTML-Datei.
 *
 * Ablauf: esbuild buendelt TypeScript, CSS und JSON zu je einer Datei, danach
 * werden beide in die HTML-Huelle eingenaeht. Ergebnis ist eine Datei ohne
 * jeden externen Verweis - sie laeuft per Doppelklick, offline, ohne Server.
 *
 * Das Bundle wird bewusst als klassisches Script eingebettet, nicht als Modul:
 * manche Rahmen (Vorschaufenster, sandboxed iframes) fuehren Modul-Scripte
 * nicht aus. Ausserdem sitzt es am Ende des Body, damit das Wurzelelement
 * beim Ausfuehren sicher vorhanden ist.
 *
 * Aufruf: node build.mjs [--klein]
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import path from 'node:path';

/* Im Arbeitsrahmen liegt der Ausgabeordner fest; auf jedem anderen Rechner
   landet das Ergebnis neben dem Quelltext in "dist". */
const AUSGABE = existsSync('/mnt/user-data')
  ? '/mnt/user-data/outputs'
  : path.join(import.meta.dirname, 'dist');
const klein = process.argv.includes('--klein');

const ergebnis = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  write: false,
  outdir: 'build-tmp',
  loader: { '.json': 'json', '.css': 'css' },
  logLevel: 'warning',
  legalComments: 'none',
});

let js = '';
let css = '';
for (const datei of ergebnis.outputFiles) {
  if (datei.path.endsWith('.css')) css = datei.text;
  else js = datei.text;
}
if (!js) throw new Error('Kein JavaScript erzeugt.');

// Ein "</script>" im Code wuerde den Block vorzeitig beenden.
js = js.replace(/<\/script>/g, '<\\/script>');

let html = await readFile('index.html', 'utf8');
html = html.replace(/\s*<script type="module"[^>]*><\/script>/, '');
html = html.replace('</head>', `  <style>\n${css}\n    </style>\n  </head>`);

await mkdir(AUSGABE, { recursive: true });

if (!klein) {
  const stelle = html.lastIndexOf('</body>');
  const voll = html.slice(0, stelle)
    + '    <script>window.__etLief=true;\n' + js + '\n    </script>\n  '
    + html.slice(stelle);
  pruefe(voll);
  const ziel = path.join(AUSGABE, 'imperwartor.html');
  await writeFile(ziel, voll, 'utf8');
  console.log(`geschrieben: ${ziel}  ${(Buffer.byteLength(voll) / 1024).toFixed(1)} kB`);
} else {
  const gepackt = gzipSync(Buffer.from(js, 'utf8'), { level: 9 }).toString('base64');
  const lader = `
      (function () {
        window.__etLief = true;
        var daten = document.getElementById('nutzlast').textContent.trim();
        function melde(t) {
          var b = document.getElementById('boot');
          if (!b) return;
          b.innerHTML = '';
          var h = document.createElement('h1'); h.textContent = 'imperWARtor';
          var p = document.createElement('pre'); p.textContent = t;
          b.appendChild(h); b.appendChild(p);
        }
        if (typeof DecompressionStream === 'undefined') {
          melde('Dieser Browser kann die gepackte Fassung nicht entpacken '
            + '(DecompressionStream fehlt, noetig ab Safari 16.4).\\n\\n'
            + 'Bitte die ungepackte Datei imperwartor.html verwenden.');
          return;
        }
        var roh = atob(daten);
        var bytes = new Uint8Array(roh.length);
        for (var i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
        new Response(new Blob([bytes]).stream()
          .pipeThrough(new DecompressionStream('gzip'))).text()
          .then(function (code) {
            var s = document.createElement('script');
            s.textContent = code;
            document.body.appendChild(s);
          })
          .catch(function (e) { melde('Entpacken fehlgeschlagen: ' + (e && e.message ? e.message : e)); });
      })();`;
  const stelle = html.lastIndexOf('</body>');
  const voll = html.slice(0, stelle)
    + '    <script id="nutzlast" type="application/octet-stream">\n' + gepackt + '\n    </script>\n'
    + '    <script>' + lader + '\n    </script>\n  '
    + html.slice(stelle);
  pruefe(voll);
  const ziel = path.join(AUSGABE, 'imperwartor-klein.html');
  await writeFile(ziel, voll, 'utf8');
  console.log(`geschrieben: ${ziel}  ${(Buffer.byteLength(voll) / 1024).toFixed(1)} kB`);
}

/** Sicherstellen, dass nichts nach aussen verweist. */
function pruefe(text) {
  const verweise = [...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const extern = verweise.filter((v) => !v.startsWith('data:') && !v.startsWith('#'));
  if (extern.length) throw new Error('Externe Verweise gefunden: ' + extern.join(', '));
}
