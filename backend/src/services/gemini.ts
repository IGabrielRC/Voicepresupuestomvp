import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../lib/env.js';

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const PROMPT = `Sos un asistente que ayuda a contratistas a generar presupuestos a partir de notas de voz en español rioplatense (Argentina, Uruguay).

Recibís el audio de un contratista. Él habla informal y rápido, en un solo mensaje. Tu trabajo es extraer TODAS las tareas/items que menciona, cada una como un item SEPARADO, con cantidad y precio cuando se puedan inferir.

Ejemplo 1: "para Juan Pérez, hágale dos metros de pared de durlock, mano de obra a 8000 el metro, más tres metros de pintura a 5000, y un viaje de materiales a 15000"
→ 3 items, todos con qty y unit_price numéricos.

Ejemplo 2: "le paso presupuesto a María, son 5 horas de plomería a 6000, más 2 canillas a 8000, materiales aparte"
→ 2 items. "materiales aparte" NO es un item (es una nota).

Ejemplo 3: "para hacer una habitación, presupuesto aprox 200 lucas"
→ 1 item con description="Habitación completa", qty=1, unit_price=200000. NO devolver null en unit_price porque "200 lucas" es un precio claro.

Ejemplo 4 (CRÍTICO — el caso que más falla): "necesito que hagas: arreglar la canilla, cambiar la cerradura y pintar la pared"
→ 3 items, UNO POR TAREA. qty=1 cada uno, unit_price=null (el contratista completará los precios). NUNCA agrupes las 3 tareas en un solo item.

Ejemplo 5: "tenés que venir a ver: 1) pérdida en el baño, 2) una rajadura en la pared, 3) la cocina"
→ 3 items separados.

Devolvé EXCLUSIVAMENTE un JSON válido con este schema (sin markdown, sin \`\`\`json):

{
  "client_name": string | null,
  "client_contact": string | null,
  "currency": "USD" (o "ARS" si el contratista lo aclara; por defecto "USD"),
  "notes": string | null,
  "terms": string | null,
  "items": [
    { "description": string, "qty": number | null, "unit_price": number | null }
  ],
  "missing_fields": string[]
}

Reglas CRÍTICAS de extracción (esto es lo que más falla):
- **CADA TAREA DISTINTA ES UN ITEM SEPARADO**. Si el contratista dice "arreglar X, cambiar Y, pintar Z" → 3 items. NUNCA los agrupes en uno solo. Si dice "tarea 1, tarea 2, tarea 3" → 3 items. Si enumera con "1)...2)...3)..." → 3 items. Separadores que indican items distintos: comas, "y", "más", "luego", "después", "también", punto y coma, "y además", "además de".
- **qty POR DEFECTO ES 1**. Si el contratista NO menciona cantidad, asumí 1. NUNCA devuelvas qty=null a menos que sea un caso muy raro donde claramente no se puede asumir (ej: "varios", "bastantes"). Casi siempre qty=1 es la respuesta correcta.
- SI el audio menciona un número asociado a un item, EXTRÁELO. No devuelvas null "por las dudas". Ej: "a 8000" → unit_price: 8000. "dos metros" → qty: 2.
- "X lucas", "X mil", "X pesos", "X dólares" = precio. Convertí: "lucas" = miles (200 lucas = 200000), "mil" o "k" = miles. Si dice solo "X lucas" sin item, ponelo como items[0] con qty=1.
- "mano de obra a X" = unit_price X, qty va aparte si lo dice.
- Si dice "materiales aparte" o "no incluye materiales" → nota, NO item.
- Cantidades en palabras ("dos", "tres", "media") convertilas a número (2, 3, 0.5).

Reglas generales:
- Si el contratista no menciona un campo (cliente, contacto, términos), devolvé null.
- "terms" son condiciones de pago, plazos, etc. Si no las dice, null.
- "notes" son aclaraciones ("materiales a cargo del cliente", "válido por 15 días", etc.).
- "client_contact" puede ser teléfono, email o dirección. Si no lo da, null.

Respondé SOLO el JSON. Nada más.`;

export interface QuoteJson {
  client_name: string | null;
  client_contact: string | null;
  currency: string;
  notes: string | null;
  terms: string | null;
  items: Array<{ description: string; qty: number | null; unit_price: number | null }>;
  missing_fields: string[];
}

export async function audioToQuote(audio: Buffer, mimeType: string): Promise<QuoteJson> {
  // Models are tried in order. First that works wins. This is robust to
  // model deprecation (the error we hit: gemini-1.5-flash is gone from v1beta).
  // Use apiVersion: 'v1' (stable) so older model names still resolve.
  const candidates = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];
  const base64 = audio.toString('base64');

  let lastError: unknown = null;
  for (const modelName of candidates) {
    try {
      const model = client.getGenerativeModel(
        { model: modelName },
        { apiVersion: 'v1', timeout: 60000 }
      );
      const result = await model.generateContent([
        { text: PROMPT },
        { inlineData: { data: base64, mimeType } },
      ]);
      const raw = result.response.text();
      console.log(`[gemini] ok with model=${modelName}`);
      return parseQuoteJson(raw);
    } catch (e: any) {
      lastError = e;
      console.warn(`[gemini] model=${modelName} failed: ${e?.message || e}`);
    }
  }
  throw new Error(
    `No Gemini model is available with this API key. Last error: ${
      (lastError as any)?.message || 'unknown'
    }`
  );
}

export function parseQuoteJson(raw: string): QuoteJson {
  // Robust: extract the first {...} block in case Gemini wraps it in prose or markdown.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in Gemini response');
  const parsed = JSON.parse(match[0]);
  return {
    client_name: parsed.client_name ?? null,
    client_contact: parsed.client_contact ?? null,
    currency: parsed.currency || 'USD',
    notes: parsed.notes ?? null,
    terms: parsed.terms ?? null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
  };
}
