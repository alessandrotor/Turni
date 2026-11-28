// Il `.htaccess` per gli hosting Apache (IONOS, Aruba, OVH, Hetzner), ricavato
// da `public/_headers`:
//
//   node scripts/genera-htaccess.mjs [cartella]      (default: dist)
//
// PERCHÉ SI GENERA E NON SI SCRIVE A MANO
// `_headers` è il file di Cloudflare Pages, e porta tutto ciò che conta: la CSP
// (la garanzia dell'informativa su dove la pagina può mandare dati), gli asset
// immutabili e soprattutto `Cache-Control: no-cache` su `sw.js`, senza il quale
// su alcuni browser gli aggiornamenti non arrivano MAI (CLAUDE.md, 1° settembre
// 2026). Due file scritti a mano che dicono la stessa cosa divergono alla prima
// modifica, e il difetto non si vede: il sito funziona, solo non protegge o non
// si aggiorna. Con una fonte sola, cambiare la CSP in `_headers` la cambia
// ovunque. → check-htaccess.mjs
//
// COSA AGGIUNGE CHE SU PAGES ERA GRATIS
// Pages fa da sé alcune cose che Apache non fa:
//  - il ripiego delle rotte dell'app su /index.html (FallbackResource);
//  - il passaggio a HTTPS;
//  - la compressione;
//  - il tipo giusto per .webmanifest e .wasm.
// `robots.txt` su Pages è una Function (functions/robots.txt.js), che qui non
// esiste: lo scrive la pubblicazione (pubblica-produzione.yml).
//
// Gli header globali usano `always`, così valgono anche sulle risposte di
// errore e sui redirect, come su Pages.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Legge `_headers`: [{ percorso, imposta: [[nome, valore]], togli: [nome] }]. */
export function leggiHeaders(testo) {
  const blocchi = [];
  let corrente = null;
  for (const riga of testo.split(/\r?\n/)) {
    if (!riga.trim() || riga.trim().startsWith('#')) continue;
    if (!/^\s/.test(riga)) {
      corrente = { percorso: riga.trim(), imposta: [], togli: [] };
      blocchi.push(corrente);
      continue;
    }
    if (!corrente) throw new Error(`_headers: header fuori da un percorso: «${riga.trim()}»`);
    const t = riga.trim();
    if (t.startsWith('!')) { corrente.togli.push(t.slice(1).trim()); continue; }
    const i = t.indexOf(':');
    if (i < 1) throw new Error(`_headers: riga non leggibile: «${t}»`);
    corrente.imposta.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]);
  }
  return blocchi;
}

// Un valore fra virgolette doppie: le virgolette interne vanno protette.
const tra = (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// `/*` vale ovunque; `/assets/*` è un prefisso; il resto è un percorso esatto.
function condizione(percorso) {
  if (percorso === '/*') return null;
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\#]/g, '\\$&');
  if (percorso.endsWith('*')) return `"%{REQUEST_URI} =~ m#^${esc(percorso.slice(0, -1))}#"`;
  return `"%{REQUEST_URI} == '${percorso}'"`;
}

export function generaHtaccess(testoHeaders) {
  const blocchi = leggiHeaders(testoHeaders);
  const out = [
    '# GENERATO da scripts/genera-htaccess.mjs a partire da public/_headers.',
    '# Non modificare qui: si cambia _headers e si ripubblica.',
    '',
    'Options -Indexes',
    'DirectoryIndex index.html',
    '',
    '# Le rotte dell\'app (es. /?verifica, /nuovo) finiscono su index.html, come su Pages.',
    '# Le pagine vere (/privacy/, /termini/, /benvenuto/) sono cartelle con il loro index.html.',
    'FallbackResource /index.html',
    '',
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    '  # Un indirizzo solo: segnaturni.app e i www finiscono su segnaturni.it.',
    '  # I dati dell\'app stanno nel browser legati all\'indirizzo: due indirizzi',
    '  # che servono la stessa app sono due archivi diversi per la stessa persona.',
    '  RewriteCond %{HTTP_HOST} ^(www\\.)?segnaturni\\.app$ [NC,OR]',
    '  RewriteCond %{HTTP_HOST} ^www\\.segnaturni\\.it$ [NC]',
    '  RewriteRule ^ https://segnaturni.it%{REQUEST_URI} [L,R=301]',
    '  # Solo HTTPS. La seconda condizione evita il giro infinito dietro un proxy che',
    '  # termina lui il TLS e passa la richiesta in chiaro.',
    '  RewriteCond %{HTTPS} off',
    '  RewriteCond %{HTTP:X-Forwarded-Proto} !https',
    '  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
    '</IfModule>',
    '',
    'AddType application/manifest+json .webmanifest',
    'AddType application/wasm .wasm',
    '',
    '<IfModule mod_deflate.c>',
    '  AddOutputFilterByType DEFLATE text/html text/css text/plain text/javascript application/javascript application/json application/manifest+json image/svg+xml application/wasm',
    '</IfModule>',
    '',
    '<IfModule mod_headers.c>',
    '',
    '  # Solo su Apache: le immagini fuori da /assets/ non hanno l\'impronta nel nome',
    '  # e senza questa riga IONOS le serve senza durata, cioè riscaricate a ogni',
    '  # visita (PageSpeed, 28/11/2026: 110 KiB della vetrina). Un giorno, non un',
    '  # anno: lo screenshot della vetrina cambia, e chi torna deve vederlo nuovo.',
    '  <FilesMatch "\\.(jpe?g|png|webp|svg|ico)$">',
    '    Header set Cache-Control "public, max-age=86400"',
    '  </FilesMatch>',
  ];
  for (const b of blocchi) {
    const cond = condizione(b.percorso);
    const rientro = cond ? '    ' : '  ';
    out.push('', `  # ${b.percorso}`);
    if (cond) out.push(`  <If ${cond}>`);
    for (const [nome, valore] of b.imposta) out.push(`${rientro}Header always set ${nome} ${tra(valore)}`);
    for (const nome of b.togli) out.push(`${rientro}Header always unset ${nome}`);
    if (cond) out.push('  </If>');
  }
  out.push('</IfModule>', '');
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cartella = process.argv[2] ?? 'dist';
  const testo = readFileSync('public/_headers', 'utf8');
  writeFileSync(join(cartella, '.htaccess'), generaHtaccess(testo));
  console.log(`scritto ${join(cartella, '.htaccess')}`);
}
