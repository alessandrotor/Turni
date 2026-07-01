import Groq from 'groq-sdk';

function getClient() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_GROQ_API_KEY in .env.local');
  return new Groq({ apiKey, dangerouslyAllowBrowser: true });
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
  const base64 = await fileToBase64(imageFile);
  const currentYear = new Date().getFullYear();

  const response = await client.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${imageFile.type};base64,${base64}` },
        },
        {
          type: 'text',
          text: `Analizza questa immagine di un foglio turni di lavoro.
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
- Includi solo righe con orario di lavoro valido, ignora intestazioni e totali.`,
        },
      ],
    }],
  });

  const text = response.choices[0].message.content.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Nessun turno riconosciuto nell\'immagine');

  const shifts = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(shifts) || shifts.length === 0) throw new Error('Nessun turno trovato');

  return shifts.filter(s => s.date && s.startTime && s.endTime);
}
