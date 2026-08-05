// Scarica l'elenco dei CCNL vigenti dall'archivio open data del CNEL e lo
// riversa in src/data/ccnl.json, PRESERVANDO i parametri di calcolo curati a
// mano (verificato, monthlyHoursFactor, contributiExtra, enteBilaterale).
//
// Uso:  node scripts/fetch-ccnl-catalog.mjs
//
// Fonte: CNEL — Archivio Nazionale dei Contratti Collettivi di Lavoro, sezione
// "Contratti Open Data" (https://www.cnel.it/Archivio-Contratti-Collettivi/Contratti-Open-Data).
// Dati rilasciati con licenza Italian Open Data License v2.0 (IODL 2.0),
// aggiornati settimanalmente. Questo script NON scarica il testo dei contratti:
// crea solo l'elenco con le info principali, base da cui in futuro ricavare e
// analizzare il testo di ciascun CCNL.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'ccnl.json');

const API_URL =
  'https://az-apim-cne-sa-0002-lgc-we.azure-api.net/ricerca-api/ricerca/pubblica/open-data?type=ARCHIVIO_CORRENTE';

// Campi di calcolo curati a mano: non vanno MAI sovrascritti dal catalogo.
const CURATED_FIELDS = ['verificato', 'monthlyHoursFactor', 'contributiExtra', 'enteBilaterale'];

function firstDefined(...vals) {
  return vals.find(v => v !== undefined && v !== null && v !== '') ?? null;
}

// Estrae dal record CNEL le sole info principali che ci interessano.
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
    // Punto d'ingresso all'archivio: idAccordo + codice permettono di ricavare
    // in seguito il testo del singolo contratto.
    fonte: 'https://www.cnel.it/Archivio-Contratti/entra-nell-archivio',
    // Parametri di calcolo: vuoti finché non li verifichiamo su una busta reale.
    verificato: false,
    monthlyHoursFactor: null,
    contributiExtra: [],
    enteBilaterale: null,
  };
}

// Tiene, per ogni codiceCcnl, l'accordo con decorrenza più recente.
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

async function main() {
  console.log('→ Scarico l\'archivio CCNL vigenti dal CNEL...');
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CNEL API ${res.status} ${res.statusText}`);
  const raw = await res.json();
  const records = Array.isArray(raw) ? raw : raw.data || raw.results || raw.content || [];
  if (!records.length) throw new Error('Risposta vuota o formato inatteso dal CNEL.');
  console.log(`  ${records.length} record ricevuti.`);

  // Solo i CCNL attualmente vigenti; se il flag manca ovunque, teniamo tutto.
  const vigenti = records.filter(r => r.ultimoAccordoVigente === true);
  const source = vigenti.length ? vigenti : records;
  if (!vigenti.length) console.log('  ⚠️ nessun flag ultimoAccordoVigente: tengo tutti i record.');

  const catalog = dedupeByCodice(source.map(toCatalogEntry).filter(e => e.codice && e.codice !== 'null'));
  catalog.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  console.log(`  ${catalog.length} CCNL vigenti (dopo dedup per codice).`);

  // Merge non distruttivo sul file esistente.
  const existing = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  const existingByCode = new Map(existing.map(e => [e.codice, e]));

  let nuovi = 0;
  let aggiornati = 0;
  for (const entry of catalog) {
    const prev = existingByCode.get(entry.codice);
    if (prev) {
      // Aggiorna le info principali ma conserva i parametri di calcolo curati.
      const merged = { ...entry };
      for (const f of CURATED_FIELDS) merged[f] = prev[f];
      existingByCode.set(entry.codice, merged);
      aggiornati++;
    } else {
      existingByCode.set(entry.codice, entry);
      nuovi++;
    }
  }

  // Ordine finale: prima le voci curate già presenti (nell'ordine originale),
  // poi le nuove voci di catalogo in ordine alfabetico.
  const existingCodes = new Set(existing.map(e => e.codice));
  const curatedFirst = existing.map(e => existingByCode.get(e.codice));
  const added = catalog
    .filter(e => !existingCodes.has(e.codice))
    .map(e => existingByCode.get(e.codice));
  const out = [...curatedFirst, ...added];

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`✓ Scritto ${OUT_FILE}`);
  console.log(`  totale voci: ${out.length}  |  nuove: ${nuovi}  |  aggiornate: ${aggiornati}`);
}

main().catch(err => {
  console.error('✗ Errore:', err.message);
  process.exit(1);
});
