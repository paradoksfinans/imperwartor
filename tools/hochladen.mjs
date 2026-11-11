/**
 * Baut alles und spiegelt das Projekt in den Klon des Repositorys.
 *
 * Das Repository bekommt nur, was hineingehoert: Quelltext, Werkzeuge,
 * Pruefungen und den fertigen Ordner "site". Was sich aus diesen Dateien
 * wiederherstellen laesst - node_modules, dist, Zwischenstaende - bleibt
 * draussen.
 *
 * Aufruf: node tools/hochladen.mjs
 * Danach im Klon: git add -A && git commit && git push
 */

import { cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const HIER = path.join(import.meta.dirname, '..');
const KLON = '/home/claude/empire-tactics';

if (!existsSync(path.join(KLON, '.git'))) {
  throw new Error(`Kein Klon unter ${KLON}.`);
}

const ORDNER = ['src', 'tools', 'test', 'site', '.github'];
const DATEIEN = [
  'build.mjs', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'README.md', '.gitignore',
];

for (const o of ORDNER) {
  await rm(path.join(KLON, o), { recursive: true, force: true });
  await cp(path.join(HIER, o), path.join(KLON, o), { recursive: true });
}
for (const d of DATEIEN) {
  await cp(path.join(HIER, d), path.join(KLON, d));
}

console.log('gespiegelt nach', KLON);
console.log('Ordner:', (await readdir(KLON)).filter((n) => n !== '.git').join(', '));
