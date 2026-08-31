// Genera la pagina pubblica dell'informativa:
//
//   node scripts/genera-privacy.mjs        (gira da solo prima di ogni build)
//
// PERCHE' NON DUE FILE SCRITTI A MANO
// L'informativa deve esistere in due posti: leggibile nel repository e
// raggiungibile da un indirizzo pubblico. Tenerne due copie significa che prima
// o poi divergono — e la copia che l'utente legge diventa quella sbagliata,
// senza che nessuno se ne accorga. Qui la sorgente e' una sola, `docs/privacy.md`,
// e la pagina si rigenera.
//
// PERCHE' NON UNA ROTTA DELL'APP
// Una rotta React non risponderebbe a chi apre il link senza JavaScript, e
// soprattutto e' proprio il caso in cui l'app e' rotta che l'informativa deve
// restare leggibile. Una pagina statica in `public/` viene servita da Cloudflare
// Pages prima del ripiego sulla SPA.
//
// IL RENDERER E' MINIMO E SUSCETTIBILE DI PROPOSITO
// Copre solo cio' che il documento usa. Se incontra una riga che non sa
// interpretare si ferma con un errore invece di ometterla: una riga persa in
// silenzio dentro un'informativa e' esattamente il guasto che conta.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SORGENTE = 'docs/privacy.md';
const USCITA = 'public/privacy/index.html';

const esc = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Grassetto, codice, link espliciti e URL nudi. L'ordine conta: prima il
// codice, cosi' che dentro `...` non si applichi altro.
function inline(s) {
  const codici = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${codici.push(`<code>${c}</code>`) - 1}\u0000`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" rel="noopener">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codici[Number(i)]);
}

const righe = readFileSync(SORGENTE, 'utf8').split(/\r?\n/);
const out = [];
let i = 0;

while (i < righe.length) {
  const r = righe[i];

  if (!r.trim()) { i++; continue; }

  const h = r.match(/^(#{1,3}) (.+)$/);
  if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

  if (r.startsWith('```')) {
    const corpo = [];
    i++;
    while (i < righe.length && !righe[i].startsWith('```')) corpo.push(esc(righe[i++]));
    i++; // la chiusura
    out.push(`<pre><code>${corpo.join('\n')}</code></pre>`);
    continue;
  }

  if (r.startsWith('|')) {
    const celle = (l) => l.split('|').slice(1, -1).map(c => c.trim());
    const intestazione = celle(righe[i++]);
    i++; // la riga dei trattini
    const corpo = [];
    while (i < righe.length && righe[i].startsWith('|')) corpo.push(celle(righe[i++]));
    out.push('<div class="tabella"><table><thead><tr>'
      + intestazione.map(c => `<th>${inline(c)}</th>`).join('')
      + '</tr></thead><tbody>'
      + corpo.map(rr => '<tr>' + rr.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
      + '</tbody></table></div>');
    continue;
  }

  if (r.startsWith('- ')) {
    const voci = [];
    while (i < righe.length && (righe[i].startsWith('- ') || /^ {2,}\S/.test(righe[i]))) {
      if (righe[i].startsWith('- ')) voci.push(righe[i].slice(2));
      else voci[voci.length - 1] += ' ' + righe[i].trim();   // continuazione a capo
      i++;
    }
    out.push('<ul>' + voci.map(v => `<li>${inline(v)}</li>`).join('') + '</ul>');
    continue;
  }

  if (/^[A-Za-zÀ-ÿ0-9*`(“"]/.test(r)) {
    const p = [];
    while (i < righe.length && righe[i].trim() && !/^(#|-|\||```)/.test(righe[i])) p.push(righe[i++].trim());
    out.push(`<p>${inline(p.join(' '))}</p>`);
    continue;
  }

  console.error(`\nRiga ${i + 1} non interpretabile, e non la ometto in silenzio:\n  ${r}\n`);
  process.exit(1);
}

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informativa sulla privacy — Turni</title>
<meta name="description" content="Quali dati escono dal tuo dispositivo usando Turni, dove vanno e perche.">
<style>
  :root { color-scheme: light dark; --testo:#1f2933; --sfondo:#fff; --tenue:#5b6570;
          --bordo:#e3e8ee; --accento:#2563eb; --nota:#fff8e1; }
  @media (prefers-color-scheme: dark) {
    :root { --testo:#e6e9ee; --sfondo:#14181d; --tenue:#9aa4b2; --bordo:#2a3138;
            --accento:#7aa2f7; --nota:#2a2617; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--sfondo); color:var(--testo);
         font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:44rem; margin:0 auto; padding:2.5rem 1.25rem 5rem; }
  h1 { font-size:1.9rem; line-height:1.25; margin:0 0 .4rem; }
  h2 { font-size:1.3rem; margin:2.5rem 0 .6rem; padding-top:1.2rem;
       border-top:1px solid var(--bordo); }
  h3 { font-size:1.05rem; margin:1.8rem 0 .4rem; }
  p, ul { margin:.7rem 0; }
  ul { padding-left:1.3rem; }
  li { margin:.35rem 0; }
  a { color:var(--accento); }
  code { font-size:.9em; background:rgba(127,127,127,.14); padding:.1em .35em; border-radius:4px; }
  pre { background:rgba(127,127,127,.1); padding:.9rem 1rem; border-radius:8px; overflow-x:auto; }
  pre code { background:none; padding:0; }
  .tabella { overflow-x:auto; margin:1rem 0; }
  table { border-collapse:collapse; width:100%; min-width:30rem; }
  th, td { text-align:left; padding:.6rem .7rem; border-bottom:1px solid var(--bordo);
           vertical-align:top; font-size:.95rem; }
  th { font-weight:600; }
  .torna { display:inline-block; margin-bottom:1.5rem; font-size:.9rem; }
</style>
</head>
<body>
<main>
<a class="torna" href="/">← Torna a Turni</a>
${out.join('\n')}
</main>
</body>
</html>
`;

mkdirSync('public/privacy', { recursive: true });
writeFileSync(USCITA, html, 'utf8');
console.log(`${USCITA} rigenerata da ${SORGENTE} (${out.length} blocchi).`);
