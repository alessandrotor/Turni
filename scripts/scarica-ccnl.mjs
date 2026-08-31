// ============================================================================
//  scarica-ccnl.mjs — Elenco dei CCNL vigenti dall'archivio open data CNEL
// ============================================================================
//
//  COS'È: un piccolo programma che scarica da internet l'elenco di tutti i
//  Contratti Collettivi Nazionali di Lavoro (CCNL) attualmente in vigore e lo
//  salva in due file — uno .json e uno .csv (apribile in Excel) — con le info
//  principali di ciascun contratto (codice, denominazione, settore, parti
//  firmatarie, date di vigenza). NON scarica il testo dei contratti: crea la
//  LISTA da cui poi ricavarli.
//
//  ".mjs" è semplicemente un file JavaScript "a moduli": si esegue con Node e
//  funziona da QUALSIASI cartella, anche fuori da questo progetto, senza alcuna
//  configurazione. Ti serve solo Node.js installato (versione 18 o superiore).
//
//  USO:
//     node scarica-ccnl.mjs                 → crea ./ccnl.json e ./ccnl.csv
//     node scarica-ccnl.mjs elenco.json     → scrive in elenco.json (+ elenco.csv)
//     node scarica-ccnl.mjs /percorso/x.json→ scrive nel percorso indicato
//     node scarica-ccnl.mjs --help          → mostra questo aiuto
//
//  Se il file di output esiste già, i campi curati a mano non vengono persi
//  (vedi CAMPI_CURATI qui sotto): puoi rilanciarlo per aggiornare l'elenco senza
//  buttare via le modifiche.
//
//  Fonte dei dati: CNEL — Archivio Nazionale dei Contratti Collettivi di Lavoro,
//  sezione "Contratti Open Data". Licenza Italian Open Data License v2.0 (IODL 2.0),
//  aggiornamento settimanale.
//  https://www.cnel.it/Archivio-Contratti-Collettivi/Contratti-Open-Data
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API_URL =
  'https://az-apim-cne-sa-0002-lgc-we.azure-api.net/ricerca-api/ricerca/pubblica/open-data?type=ARCHIVIO_CORRENTE';

// Campi che potresti aver riempito a mano (parametri di calcolo): se il file di
// output esiste già, questi valori vengono PRESERVATI e non sovrascritti.
// `note` e `fasciaNotturna` stanno in elenco per lo stesso motivo degli altri:
// sono conoscenza ricavata dai cedolini, non dati del CNEL, e un aggiornamento
// del catalogo non deve cancellarla in silenzio.
const CAMPI_CURATI = ['verificato', 'monthlyHoursFactor', 'mensilizzato', 'contributiExtra', 'enteBilaterale', 'ammortizzatori', 'note', 'fasciaNotturna'];

function firstDefined(...vals) {
  return vals.find(v => v !== undefined && v !== null && v !== '') ?? null;
}

// Estrae dal record grezzo del CNEL le sole info principali.
function toCatalogEntry(rec) {
  const codice = firstDefined(rec.codiceCcnl, rec.idAccordo && `cnel-${rec.idAccordo}`);
  const nome = firstDefined(rec.titoloCcnl, rec.titolo, '(senza titolo)');
  return {
    codice: String(codice),
    nome: String(nome).replace(/\s+/g, ' ').trim(),
    settore: firstDefined(rec.settoriDescrizione, rec.sottosettoriDescrizione),
    comparto: firstDefined(rec.comparto, rec.ambito),
    firmatari: {
      datoriali: rec.partiDatorialiFirmatarie || [],
      sindacali: rec.partiSindacaliFirmatarie || [],
    },
    vigenza: {
      decorrenza: firstDefined(rec.dataDecorrenza),
      scadenza: firstDefined(rec.dataScadenzaContrattuale, rec.dataScadenza, rec.dataScadenzaEconomica),
    },
    dipendenti: firstDefined(rec.dipendenti),
    vigente: rec.ultimoAccordoVigente === true,
    idAccordo: firstDefined(rec.idAccordo),
    fonte: 'https://www.cnel.it/Archivio-Contratti/entra-nell-archivio',
    // Parametri di calcolo: vuoti finché non verificati su una busta reale.
    verificato: false,
    monthlyHoursFactor: null,
    contributiExtra: [],
    enteBilaterale: null,
  };
}

// Per ogni codice tiene l'accordo con decorrenza più recente.
function dedupeByCodice(entries) {
  const byCode = new Map();
  for (const e of entries) {
    const prev = byCode.get(e.codice);
    if (!prev || String(e.vigenza.decorrenza || '') > String(prev.vigenza.decorrenza || '')) {
      byCode.set(e.codice, e);
    }
  }
  return [...byCode.values()];
}

// Serializza in CSV (una riga per CCNL, con le colonne principali).
function toCsv(entries) {
  const cols = ['codice', 'nome', 'settore', 'comparto', 'datoriali', 'sindacali', 'decorrenza', 'scadenza', 'vigente', 'idAccordo'];
  const esc = (v) => {
    const s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = entries.map(e => [
    e.codice, e.nome, e.settore, e.comparto,
    e.firmatari?.datoriali, e.firmatari?.sindacali,
    e.vigenza?.decorrenza, e.vigenza?.scadenza, e.vigente, e.idAccordo,
  ].map(esc).join(','));
  return [cols.join(','), ...rows].join('\n') + '\n';
}

function printHelp() {
  // Stampa il blocco di commento in testa al file (l'aiuto è già scritto lì).
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  const header = src
    .split('\n')
    .filter(l => l.startsWith('//'))
    .map(l => l.replace(/^\/\/ ?/, ''))
    .join('\n');
  console.log(header);
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') { printHelp(); return; }

  if (typeof fetch !== 'function') {
    console.error('✗ Questo script richiede Node.js 18 o superiore (manca "fetch").');
    console.error('  Aggiorna Node da https://nodejs.org e riprova.');
    process.exit(1);
  }

  const outJson = arg && !arg.startsWith('-') ? arg : 'ccnl.json';
  const outCsv = outJson.replace(/\.json$/i, '') + '.csv';

  console.log('→ Scarico l\'archivio CCNL vigenti dal CNEL...');
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CNEL API ${res.status} ${res.statusText}`);
  const raw = await res.json();
  const records = Array.isArray(raw) ? raw : raw.data || raw.results || raw.content || [];
  if (!records.length) throw new Error('Risposta vuota o formato inatteso dal CNEL.');
  console.log(`  ${records.length} record ricevuti.`);

  const vigenti = records.filter(r => r.ultimoAccordoVigente === true);
  const source = vigenti.length ? vigenti : records;
  if (!vigenti.length) console.log('  ⚠️ nessun flag "vigente": tengo tutti i record.');

  const catalog = dedupeByCodice(source.map(toCatalogEntry).filter(e => e.codice && e.codice !== 'null'));
  catalog.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  console.log(`  ${catalog.length} CCNL vigenti (dopo dedup per codice).`);

  // Merge non distruttivo se il file esiste già.
  let out = catalog;
  let nuovi = catalog.length;
  let aggiornati = 0;
  if (existsSync(outJson)) {
    let existing = [];
    try { existing = JSON.parse(readFileSync(outJson, 'utf8')); } catch { existing = []; }
    if (Array.isArray(existing) && existing.length) {
      const byCode = new Map(existing.map(e => [e.codice, e]));
      nuovi = 0;
      for (const entry of catalog) {
        const prev = byCode.get(entry.codice);
        if (prev) {
          const merged = { ...entry };
          for (const f of CAMPI_CURATI) if (f in prev) merged[f] = prev[f];
          byCode.set(entry.codice, merged);
          aggiornati++;
        } else {
          byCode.set(entry.codice, entry);
          nuovi++;
        }
      }
      // Ordine: voci già presenti (nell'ordine originale) + nuove alfabetiche.
      const existingCodes = new Set(existing.map(e => e.codice));
      const curatedFirst = existing.map(e => byCode.get(e.codice));
      const added = catalog.filter(e => !existingCodes.has(e.codice)).map(e => byCode.get(e.codice));
      out = [...curatedFirst, ...added];
    }
  }

  writeFileSync(outJson, JSON.stringify(out, null, 2) + '\n', 'utf8');
  writeFileSync(outCsv, toCsv(out), 'utf8');
  console.log(`✓ Scritto ${outJson}`);
  console.log(`✓ Scritto ${outCsv}`);
  console.log(`  totale voci: ${out.length}  |  nuove: ${nuovi}  |  aggiornate: ${aggiornati}`);
}

main().catch(err => {
  console.error('✗ Errore:', err.message);
  process.exit(1);
});
