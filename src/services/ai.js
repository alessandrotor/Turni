import Anthropic from '@anthropic-ai/sdk';
import { calcShiftMinutes } from '../utils/pay';
import { formatMonthYear } from '../utils/dates';

function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_ANTHROPIC_API_KEY in .env.local');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function generateMonthlySummary(shifts, monthDate, settings) {
  if (!shifts.length) throw new Error('Nessun turno questo mese');

  const client = getClient();

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

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Turni di ${monthName}:\n${shiftLines}\n\nTotale: ${totalHours.toFixed(1)} ore su ${shifts.length} turni.\n\nFammi un brevissimo riepilogo del mese in italiano (3-4 frasi): quante ore, andamento, qualcosa di interessante sui pattern. Niente elenchi, solo testo fluido.`,
    }],
  });

  return response.content[0].text;
}
