// La pagina d'ingresso «Mi riprendono il trattamento integrativo? Ci perdo?»
// (ci-perdo/index.html). Senza React: è una pagina che deve aprirsi subito a
// chi arriva da Google, e ha un campo e una risposta.
//
// Le cifre sono quelle di `ciPerdo()`, come nella finestra dell'app
// (CiPerdo.jsx): se le due dicessero cose diverse per lo stesso lordo, nessuna
// sarebbe credibile. Qui si disegnano soltanto. Nessun dato esce dalla pagina,
// e nessuno viene salvato.
//
// La regola sul messaggio (docs/piano-per-agenti.md): accanto al trattamento
// ripreso ci sono sempre le tasse che tornano.

import { ciPerdo, POSIZIONE } from '../motore/restituzione.js';
import { CONTRATTI } from '../motore/contratti/index.js';
import { euroCella } from '../utils/formato.js';

// Il pubblico di partenza è turismo e ristorazione; chi non lo sa lo cambia.
const CONTRATTO_INIZIALE = 'turismo';

const campo = /** @type {HTMLInputElement} */ (document.getElementById('lordo'));
const scelta = /** @type {HTMLSelectElement} */ (document.getElementById('ccnl'));
const risposta = /** @type {HTMLElement} */ (document.getElementById('risposta'));

// «16.700», «16700,50», «16 700 €»: chi scrive una cifra in italiano mette i punti.
const leggiEuro = (testo) => {
  const n = Number(String(testo).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const tondo = (n) => Math.round(Math.abs(n) / 10) * 10;

const el = (tag, classe, testo) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (testo != null) e.textContent = testo;
  return e;
};

function riga(etichetta, importo, classe, larghezza) {
  const r = el('div', 'riga');
  r.append(el('span', null, etichetta));
  const barra = el('div', classe, importo);
  barra.style.width = larghezza;
  r.append(barra);
  return r;
}

function chiamata() {
  const c = el('div', 'cta');
  const a = el('a', 'btn', 'Segna i turni: lo sai prima di dicembre');
  a.href = '/';
  c.append(a, el('small', null, 'Gratis, senza account. Il conto resta sul telefono.'));
  return c;
}

function disegna() {
  const lordo = leggiEuro(campo.value);
  risposta.replaceChildren();
  if (!(lordo > 0)) {
    risposta.append(el('div', 'attesa', 'Scrivi il lordo: qui vedi quanto ti riprendono e quanto ti torna.'));
    return;
  }
  const r = ciPerdo(lordo, { ccnl: scelta.value });
  const busta = el('div', 'busta');
  if (r.posizione === POSIZIONE.SOTTO) {
    if (r.spetta) {
      busta.append(el('p', 'no', 'No, non te lo riprendono.'),
        el('small', null, `Ti restano ~${euroCella(tondo(r.margine))} lordi prima della soglia.`));
    } else {
      busta.append(el('p', 'no', 'No: con questo lordo non ti spetta.'),
        el('small', null, "Le detrazioni azzerano già l'IRPEF, quindi non c'è niente da riprendere."));
    }
  } else {
    const scala = Math.max(r.perso, r.compensa, 1);
    const pct = (v) => `${Math.max(30, Math.round((v / scala) * 100))}%`;
    const oltre = r.posizione === POSIZIONE.OLTRE;
    const perdi = r.totale < 0;
    busta.append(el('div', 'tit', `A ${euroCella(lordo)} lordi, a dicembre`),
      riga('Ti riprendono', `−${euroCella(r.perso)}`, 'meno', pct(r.perso)),
      riga(oltre ? 'Tasse in meno e ore in più' : 'Ti tornano di tasse', `+${euroCella(r.compensa)}`, 'piu', pct(r.compensa)));
    const saldo = el('div', 'saldo');
    const cifra = el('b', null, `~${euroCella(tondo(r.totale))}`);
    cifra.style.color = perdi ? 'var(--rosso)' : 'var(--verde)';
    saldo.append(el('span', null, perdi ? "Ci perdi, in un anno" : 'Ci guadagni'), cifra);
    busta.append(saldo);
    if (perdi && r.mancaPareggio > 0) busta.append(el('small', null, `Bastano ~${euroCella(tondo(r.mancaPareggio))} lordi in più per tornare in pari.`));
    else if (oltre) busta.append(el('small', null, 'rispetto a fermarti sotto la soglia.'));
  }
  risposta.append(busta, chiamata());
}

for (const c of [{ codice: '', nome: 'non lo so' }, ...Object.values(CONTRATTI)]) {
  const o = el('option', null, c.nome);
  o.value = c.codice;
  scelta.append(o);
}
scelta.value = CONTRATTO_INIZIALE in CONTRATTI ? CONTRATTO_INIZIALE : '';
campo.addEventListener('input', disegna);
// Al telefono la tastiera copre la risposta: «Fine» la chiude, e la risposta è lì.
campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') campo.blur(); });
scelta.addEventListener('change', disegna);
disegna();
