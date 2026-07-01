import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../lib/env.js';

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const PROMPT = `Eres un asistente que ayuda a contratistas a generar presupuestos a partir de notas de voz en español neutro.

Recibes el audio de un contratista. Él habla informal y rápido, en uno o varios mensajes seguidos. Tu trabajo es extraer TODAS las tareas/items que menciona, cada una como un item SEPARADO, con cantidad y precio cuando se puedan inferir. NUNCA agrupes varias tareas en un solo item genérico.

Devuelve EXCLUSIVAMENTE un JSON válido con este schema (sin markdown, sin \`\`\`json):

{
  "client_name": string | null,
  "client_contact": string | null,
  "currency": "USD" (o "VES" / "ARS" / "EUR" si el contratista lo aclara; por defecto "USD"),
  "notes": string | null,
  "terms": string | null,
  "items": [
    { "description": string, "qty": number | null, "unit_price": number | null }
  ],
  "missing_fields": string[]
}

Reglas CRÍTICAS de extracción (esto es lo que más falla):
- **CADA TAREA DISTINTA ES UN ITEM SEPARADO**. Si el contratista dice "arreglar X, cambiar Y, pintar Z" → 3 items. Si dice "tarea 1, tarea 2, tarea 3" → 3 items. Si enumera con "1)...2)...3)..." → 3 items. Separadores que indican items distintos: comas, "y", "más", "luego", "después", "también", punto y coma, "y además", "además de", "aparte", "por otro lado", "después hay que".
- **NUNCA crees UN SOLO ITEM que diga "Trabajo completo de ..." o "Varias tareas"**. Si el audio tiene muchas tareas, cada una es un item.
- **Materiales, áreas, trabajos y precios mencionados deben convertirse en items**. Ej: "frente de la casa", "cocina", "baño", "dos metros de durlock", "cinco horas de electricista", "un viaje de materiales" → cada uno es un item con descripción concreta.
- **qty POR DEFECTO ES 1**. Si el contratista NO menciona cantidad, asume 1. NUNCA devuelvas qty=null salvo casos realmente ambiguos (ej: "varios", "bastantes"). Casi siempre qty=1 es la respuesta correcta.
- **SI el audio menciona un número asociado a un item, EXTRÁELO**. No devuelvas null "por las dudas". Ej: "a 8000" → unit_price: 8000. "dos metros" → qty: 2. "100 dólares" → unit_price: 100. "500 bs" → unit_price: 500. "2000 bolívares" → unit_price: 2000.
- **Si un item NO tiene precio, igual crea el item** con qty=1 y unit_price=null. NO lo omitas. NO lo agrupes con otros items. El contratista completará el precio en el editor.
- **"X mil", "X pesos", "X dólares", "X USD", "X bs", "X bolívares", "X VES" = precio**. Convierte: "mil" o "k" = miles (5 mil = 5000). "dólares" o "USD" implica currency USD. "bs"/"bolívares"/"VES" implica currency VES. Si dice solo "X dólares/bs" sin item claro, asume "Presupuesto general" como items[0] con qty=1.
- **"mano de obra a X" = unit_price X**, qty va aparte si lo dice.
- **"materiales aparte", "no incluye materiales", "viene con flete", "válido por X días" → notes/terms**, NO item.
- Cantidades en palabras ("dos", "tres", "media", "un metro", "dos horas") conviértelas a número (2, 3, 0.5, 1, 2).

Reglas sobre notes vs items:
- "notes" es SOLO para contexto extra: advertencias, condiciones, instrucciones, incertidumbres, materiales a cargo del cliente, plazos de validez, etc.
- Cualquier tarea, área, material o trabajo mencionado como parte del presupuesto debe ir en "items", NO en "notes".
- Si el contratista dice "hay que revisar la pérdida" → item "Revisar pérdida", qty=1, unit_price=null.
- Si dice "después vemos los materiales" → nota "Materiales a definir".

Reglas generales:
- Si el contratista no menciona un campo (cliente, contacto, términos), devuelve null.
- "terms" son condiciones de pago, plazos, forma de pago, garantía. Si no las dice, null.
- "client_contact" puede ser teléfono, email o dirección. Si no lo da, null.
- "missing_fields": lista de campos que faltan con formato "items[N].unit_price" o "items[N].qty". Si no falta nada, array vacío.

Ejemplos:

Ejemplo 1: "para Juan Pérez, hágale dos metros de pared de durlock, mano de obra a 8000 el metro, más tres metros de pintura a 5000, y un viaje de materiales a 15000"
→ 3 items: "Pared de durlock (mano de obra)" qty=2 unit_price=8000; "Pintura" qty=3 unit_price=5000; "Viaje de materiales" qty=1 unit_price=15000.

Ejemplo 2: "le paso presupuesto a María, son 5 horas de plomería a 6000, más 2 canillas a 8000, materiales aparte"
→ 2 items: "Horas de plomería" qty=5 unit_price=6000; "Canillas" qty=2 unit_price=8000. "materiales aparte" va en notes.

Ejemplo 3: "para hacer una habitación, presupuesto aprox 200 dólares"
→ 1 item con description="Habitación completa", qty=1, unit_price=200. NO devolver null en unit_price porque "200 dólares" es un precio claro.

Ejemplo 4 (CRÍTICO): "necesito que hagas: arreglar la canilla, cambiar la cerradura y pintar la pared"
→ 3 items: "Arreglar canilla" qty=1 unit_price=null; "Cambiar cerradura" qty=1 unit_price=null; "Pintar pared" qty=1 unit_price=null.

Ejemplo 5: "tienes que venir a ver: 1) pérdida en el baño, 2) una rajadura en la pared, 3) la cocina"
→ 3 items: "Pérdida en el baño" qty=1 unit_price=null; "Rajadura en la pared" qty=1 unit_price=null; "Cocina" qty=1 unit_price=null.

Ejemplo 6 (NOTA LARGA con muchas tareas): "Para el cliente Martínez: primero tenemos que hacer el trabajo completo de cocina, que incluye arreglar la canilla que pierde, cambiar la cerradura de la puerta del fondo, pintar la pared de la cocina que está toda manchada, y después hay que revisar el baño porque hay una pérdida en la ducha. También hay que cambiar dos lámparas del living y arreglar el enchufe de la habitación. El presupuesto es aproximado porque todavía no compré los materiales."
→ 6 items: "Arreglar canilla cocina" qty=1 unit_price=null; "Cambiar cerradura puerta fondo" qty=1 unit_price=null; "Pintar pared cocina" qty=1 unit_price=null; "Revisar pérdida ducha baño" qty=1 unit_price=null; "Cambiar lámparas living" qty=2 unit_price=null; "Arreglar enchufe habitación" qty=1 unit_price=null. Notes: "Presupuesto aproximado, materiales no comprados todavía."

Responde SOLO el JSON. Nada más.`;

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

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const normalizedItems = rawItems
    .map((it: any) => ({
      description: String(it.description ?? '').trim(),
      qty: typeof it.qty === 'number' && !Number.isNaN(it.qty) ? it.qty : 1,
      unit_price: typeof it.unit_price === 'number' && !Number.isNaN(it.unit_price) ? it.unit_price : null,
    }))
    .filter((it: any) => it.description.length > 0);

  // Safety net: if Gemini returns a single generic item but the notes contain
  // multiple distinct tasks, do NOT try to re-parse here. The prompt must
  // enforce multi-item extraction. We only normalize defaults.

  return {
    client_name: parsed.client_name ?? null,
    client_contact: parsed.client_contact ?? null,
    currency: parsed.currency || 'USD',
    notes: parsed.notes ?? null,
    terms: parsed.terms ?? null,
    items: normalizedItems,
    missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
  };
}
