// NOTA: modulo attualmente NON referenziato — il riepilogo AI nel calendario è
// disattivato. Restando fuori dal grafo degli import, l'SDK Anthropic non
// finisce nel bundle (pesava ~150 KB nel chunk principale). Se si riattiva la
// funzione, tenere l'import di Anthropic dinamico come qui sotto.
import { GoogleGenAI } from '@google/genai';
import { calcShiftMinutes } from '../utils/pay';
import { formatMonthYear } from '../utils/dates';

// Riepilogo mensile via Claude (opt-in, se presente la chiave Anthropic).
async function summaryWithAnthropic(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
  });
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

// Riepilogo mensile via Google Gemini (default, tier gratuito).
async function summaryWithGemini(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_GEMINI_API_KEY in .env.local');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  return response.text;
}

// Formatta un importo in euro per il prompt (senza dipendere da Intl nel testo).
const eur = (n) => `${Math.round(n)}€`;

export async function generateMonthlySummary(shifts, monthDate, settings, context = {}) {
  if (!shifts.length) throw new Error('Nessun turno questo mese');

  const shiftLines = shifts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => {
      const mins = calcShiftMinutes(s);
      const hrs = (mins / 60).toFixed(1);
      const note = s.note ? ` (nota: ${s.note})` : '';
      return `- ${s.date}: ${s.startTime}–${s.endTime}, pausa ${s.breakMinutes || 0} min → ${hrs}h${note}`;
    })
    .join('\n');

  const monthName = formatMonthYear(monthDate);
  const c = context;

  // Blocco dati concreti: solo le voci disponibili.
  const facts = [];
  if (c.totalHours != null) facts.push(`Ore totali: ${c.totalHours.toFixed(1)}h su ${c.shiftsCount ?? shifts.length} turni.`);
  if (c.overtimeHours != null && c.overtimeHours > 0) facts.push(`Di cui straordinari: ${c.overtimeHours.toFixed(1)}h.`);
  if (c.workedDays != null) facts.push(`Giorni lavorati: ${c.workedDays}, giorni di riposo: ${c.restDays}.`);
  if (c.sundaysWorked != null && c.sundaysWorked > 0) facts.push(`Domeniche lavorate: ${c.sundaysWorked}.`);
  if (c.shiftsWithSurcharge != null && c.shiftsWithSurcharge > 0) facts.push(`Turni con maggiorazione: ${c.shiftsWithSurcharge}.`);
  if (c.maxConsecutive != null && c.maxConsecutive >= 5) facts.push(`Sequenza più lunga di giorni consecutivi: ${c.maxConsecutive}.`);
  if (c.gross != null) facts.push(`Guadagno lordo del mese: ${eur(c.gross)}${c.surcharge ? ` (di cui ${eur(c.surcharge)} da maggiorazioni)` : ''}.`);
  if (c.net != null) facts.push(`Netto stimato: ${eur(c.net)} (trattenute ${eur(c.trattenute)}${c.bonus ? `, bonus +${eur(c.bonus)}` : ''}).`);
  if (c.bonusRenzi?.marginToFull != null) facts.push(`Bonus Renzi: mancano ${eur(c.bonusRenzi.marginToFull)} alla soglia dei 15.000€ (reddito annuo ${eur(c.bonusRenzi.income)}).`);
  else if (c.bonusRenzi?.marginToMax != null) facts.push(`Bonus Renzi (parziale): mancano ${eur(c.bonusRenzi.marginToMax)} alla soglia dei 28.000€ (reddito annuo ${eur(c.bonusRenzi.income)}).`);

  const prompt = `Sei un assistente per un lavoratore dipendente che tiene traccia dei suoi turni.

Mese: ${monthName}.
Dati del mese:
${facts.join('\n')}

Dettaglio turni:
${shiftLines}

Scrivi un riepilogo BREVE (4-6 frasi, italiano fluido, niente elenchi puntati) pensato per essere UTILE AL LAVORATORE. Concentrati su: quante ore ha fatto e quanti straordinari, quanto ha guadagnato di lordo e soprattutto di netto stimato, domeniche/maggiorazioni se rilevanti, e l'equilibrio lavoro-riposo. Chiudi con UN avviso o consiglio pratico se pertinente (es. vicinanza alla soglia del bonus Renzi, molti giorni consecutivi senza riposo, tanti straordinari). Usa i numeri concreti forniti. Non inventare dati non presenti.`;

  // Default Gemini; se è impostata una chiave Anthropic si usa Claude.
  return import.meta.env.VITE_ANTHROPIC_API_KEY
    ? summaryWithAnthropic(prompt)
    : summaryWithGemini(prompt);
}
