import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calcShiftMinutes } from '../utils/pay';
import { formatMonthYear } from '../utils/dates';

// Riepilogo mensile via Claude (opt-in, se presente la chiave Anthropic).
async function summaryWithAnthropic(prompt) {
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
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-flash-latest' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateMonthlySummary(shifts, monthDate, settings) {
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

  const totalHours = shifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0) / 60;
  const monthName = formatMonthYear(monthDate);

  const prompt = `Turni di ${monthName}:\n${shiftLines}\n\nTotale: ${totalHours.toFixed(1)} ore su ${shifts.length} turni.\n\nFammi un brevissimo riepilogo del mese in italiano (3-4 frasi): quante ore, andamento, qualcosa di interessante sui pattern. Niente elenchi, solo testo fluido.`;

  // Default Gemini; se è impostata una chiave Anthropic si usa Claude.
  return import.meta.env.VITE_ANTHROPIC_API_KEY
    ? summaryWithAnthropic(prompt)
    : summaryWithGemini(prompt);
}
