// Riscontro della strada scelta per consegnare un file all'utente:
//
//   node scripts/check-consegna-file.mjs
//
// PERCHÉ ESISTE
// Fino al 31 agosto 2026 `deliver()` finiva con `a.click()` e non restituiva
// niente. `a.click()` non lancia e non riferisce: se il download era bloccato —
// Safari su iOS in modalità PWA, i browser dentro Instagram e Facebook — la
// promessa si risolveva ugualmente e l'app annunciava «Backup scaricato: N
// turni al sicuro». L'utente restava senza copia e senza saperlo, e lo scopriva
// il giorno in cui il backup serviva.
//
// La correzione non è un messaggio più prudente: è che ogni strada dica cosa è
// successo davvero. Una sola delle tre permette di promettere qualcosa.
//
//   condivisione   (app nativa)     → il file passa al foglio di sistema
//   salvaConNome   (File System API) → l'utente sceglie il file e la scrittura
//                                      o riesce o lancia: è l'UNICA verificabile
//   download       (tutto il resto)  → non verificabile, e va detto
//
// COSA SI RISCONTRA QUI
// La sola decisione, che è logica pura e non ha bisogno di un browser. Il
// resto — che `showSaveFilePicker` scriva davvero, che Share si comporti come
// dice — è codice di piattaforma e si prova a mano sui dispositivi (vedi la
// domanda 8 di RILASCIO.md).
//
// NOTA: questo file non importa `services/export.js`, che dipende da Capacitor
// e dal DOM e non è caricabile da Node puro. La funzione è ricopiata qui sotto,
// ed è il motivo per cui è stata scritta come funzione pura di tre righe: se
// cambia là, questo riscontro non se ne accorge, ma la copia è abbastanza breve
// da rendere la divergenza evidente a chi la tocca.

// ── la decisione, come sta in services/export.js ───────────────────────────
function stradaDiConsegna({ nativo, salvaConNome }) {
  if (nativo) return 'condivisione';
  if (salvaConNome) return 'salvaConNome';
  return 'download';
}

// ── casi ───────────────────────────────────────────────────────────────────
const casi = [
  {
    nome: 'APK Android: il foglio di condivisione',
    dato: { nativo: true, salvaConNome: false },
    atteso: 'condivisione',
    perche: 'sul nativo il picker del browser non esiste e Share è la via giusta',
  },
  {
    nome: 'APK con entrambe disponibili: vince il nativo',
    dato: { nativo: true, salvaConNome: true },
    atteso: 'condivisione',
    perche: 'dentro la WebView un picker del browser confonderebbe due sistemi di file',
  },
  {
    nome: 'Chrome/Edge desktop: salva con nome',
    dato: { nativo: false, salvaConNome: true },
    atteso: 'salvaConNome',
    perche: "è l'unica strada in cui sappiamo se il file è stato scritto",
  },
  {
    nome: 'Firefox, Safari, iOS: download semplice',
    dato: { nativo: false, salvaConNome: false },
    atteso: 'download',
    perche: 'nessuna API per sapere se è arrivato: l\'esito va dichiarato non verificabile',
  },
];

let falliti = 0;
console.log('\nStrada di consegna del file\n');
for (const c of casi) {
  const avuto = stradaDiConsegna(c.dato);
  const ok = avuto === c.atteso;
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${c.nome.padEnd(44)} → ${avuto}`);
  if (!ok) console.log(`       atteso ${c.atteso}: ${c.perche}`);
}

// La proprietà che conta più dei singoli casi: nessuna combinazione può
// produrre una strada che promette un esito verificabile senza esserlo.
// «salvaConNome» deve uscire SOLO quando l'API c'è davvero.
console.log('');
let violazioni = 0;
for (const nativo of [true, false]) {
  for (const salvaConNome of [true, false]) {
    const strada = stradaDiConsegna({ nativo, salvaConNome });
    if (strada === 'salvaConNome' && !salvaConNome) violazioni += 1;
  }
}
const ok = violazioni === 0;
if (!ok) falliti += 1;
console.log(`  ${ok ? 'ok  ' : 'FALLITO'} mai «salva con nome» senza l'API che lo rende verificabile`);

console.log(`\n${casi.length + 1} controlli, ${falliti} falliti\n`);
process.exit(falliti > 0 ? 1 : 0);
