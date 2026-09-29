// Chamada ao Gemini com resposta JSON estruturada (REST, sem SDK).
// Plano gratuito vive com 503 (sobrecarga) e 429 (cota): tenta o próximo modelo da lista nesses casos.
const MODELS = [process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest'];

export async function geminiJSON(system, text, schema) {
  let lastError;
  for (const model of [...new Set(MODELS)]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    const data = await res.json();
    if (res.status === 503 || res.status === 429) { lastError = `${model}: ${data.error?.message}`; continue; }
    if (!res.ok) throw new Error(`${model}: ${data.error?.message || res.status}`);
    const cand = data.candidates?.[0];
    if (cand?.finishReason !== 'STOP') throw new Error(`${model} parou com ${cand?.finishReason ?? 'resposta vazia'}`);
    return JSON.parse(cand.content.parts.filter(p => !p.thought).map(p => p.text).join(''));
  }
  throw new Error(`Gemini indisponível no momento, tente de novo. (${lastError})`);
}
