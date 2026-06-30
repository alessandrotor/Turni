import { GoogleGenerativeAI } from '@google/generative-ai';

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_GEMINI_API_KEY in .env.local');
  return new GoogleGenerativeAI(apiKey);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function parseShiftsFromImage(imageFile) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const base64 = await fileToBase64(imageFile);
  const currentYear = new Date().getFullYear();

  const prompt = `Analizza questa immagine di un foglio turni di lavoro.
Estrai TUTTI i turni presenti e restituisci SOLO un array JSON valido, senza testo aggiuntivo né markdown.

Formato richiesto:
[
  { "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "breakMinutes": 0, "note": "" }
]

Regole:
- date: formato YYYY-MM-DD. Se l'anno non è indicato usa ${currentYear}.
- startTime / endTime: formato 24h HH:MM.
- breakMinutes: numero intero (0 se non specificato).
- note: tipo turno o nota libera, stringa vuota se assente.
- Includi solo righe con orario di lavoro valido, ignora intestazioni e totali.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType: imageFile.type, data: base64 } },
  ]);

  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Nessun turno riconosciuto nell\'immagine');

  const shifts = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(shifts) || shifts.length === 0) throw new Error('Nessun turno trovato');

  // Validate basic shape
  return shifts.filter(s => s.date && s.startTime && s.endTime);
}
