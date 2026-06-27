import { Router, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { audioToQuote, type QuoteJson } from '../services/gemini.js';
import {
  getFile,
  sendMessage,
  sendChatAction,
  editMessageText,
  deleteMessage,
  answerCallbackQuery,
  type InlineButton,
} from '../services/telegram.js';
import { newSlug } from '../services/slug.js';

export const telegramRouter = Router();

const WEB_URL = env.WEB_BASE_URL;

telegramRouter.post('/webhooks/telegram', async (req: Request, res: Response) => {
  // Acknowledge Telegram immediately to avoid retry storms. Handle async.
  res.sendStatus(200);

  if (env.WEBHOOK_SECRET) {
    const headerSecret = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (headerSecret !== env.WEBHOOK_SECRET) {
      console.warn('[telegram] webhook secret mismatch, ignoring');
      return;
    }
  }

  try {
    if (req.body?.callback_query) {
      await handleCallbackQuery(req.body.callback_query);
    } else if (req.body?.message) {
      await handleUpdate(req.body);
    }
  } catch (e) {
    console.error('[telegram] handler error', e);
  }
});

async function handleUpdate(update: any) {
  const msg = update?.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  const telegramUserId = msg.from?.id;
  if (!chatId || !telegramUserId) return;

  // Text commands (/start, /quotes, /help, or ANY text)
  if (msg.text) {
    await handleTextCommand(chatId, telegramUserId, msg.text);
    return;
  }

  // Voice / audio
  const isVoice = !!msg.voice;
  const isAudio = !!msg.audio;
  if (!isVoice && !isAudio) return;

  const fileId = msg.voice?.file_id || msg.audio?.file_id;
  if (!fileId) return;

  await handleVoiceNote(chatId, telegramUserId, isVoice, msg, fileId);
}

async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message?.chat?.id;
  const telegramUserId = callbackQuery.from?.id;
  const data = callbackQuery.data;
  const id = callbackQuery.id;

  // Acknowledge immediately to remove the loading state on the button.
  await answerCallbackQuery(id);

  if (!chatId) return;

  if (data === 'list_quotes' && telegramUserId) {
    await listRecentQuotes(chatId, telegramUserId);
    return;
  }

  if (data === 'help') {
    await sendMessage(
      chatId,
      `<b>Cómo usar VoiceQuote</b>\n\n` +
        `1. Mandame una <b>nota de voz</b> con los items del presupuesto.\n` +
        `2. Yo te paso un link para revisar y editar.\n` +
        `3. Cuando esté bien, hacé click en "Compartir" dentro del editor.\n` +
        `4. El link público lo mandás a tu cliente por WhatsApp.\n` +
        `5. Tu cliente acepta, rechaza o pide cambios con un click. Te aviso a vos.\n\n` +
        `<b>Comandos:</b>\n/start — bienvenida\n/quotes — tus últimos presupuestos\n/help — este mensaje`,
      { inline_keyboard: [[{ text: '🌐 Abrir la app', url: `${WEB_URL}/` }]] }
    ).catch(() => {});
    return;
  }

  if (data === 'create_new') {
    await sendMessage(
      chatId,
      `Mandame una <b>nota de voz</b> con el detalle del nuevo presupuesto. ` +
        `Te paso el link al editor en unos segundos. 🎙️`
    ).catch(() => {});
    return;
  }
}

async function handleTextCommand(chatId: number, telegramUserId: number, text: string) {
  const cmd = text.trim().toLowerCase();

  if (cmd === '/start') {
    await showWelcome(chatId);
    return;
  }

  if (cmd === '/quotes') {
    await listRecentQuotes(chatId, telegramUserId);
    return;
  }

  if (cmd === '/help') {
    await sendMessage(
      chatId,
      `<b>Cómo usar VoiceQuote</b>\n\n` +
        `1. Mandame una <b>nota de voz</b> con los items del presupuesto.\n` +
        `2. Yo te paso un link para revisar y editar.\n` +
        `3. Cuando esté bien, hacé click en "Compartir" dentro del editor.\n` +
        `4. El link público lo mandás a tu cliente por WhatsApp.\n` +
        `5. Tu cliente acepta, rechaza o pide cambios con un click. Te aviso a vos.\n\n` +
        `<b>Comandos:</b>\n/start — bienvenida\n/quotes — tus últimos presupuestos\n/help — este mensaje`,
      { inline_keyboard: [[{ text: '🌐 Abrir la app', url: `${WEB_URL}/` }]] }
    ).catch(() => {});
    return;
  }

  // ANY other text: auto-welcome. Don't be a "command-only" bot.
  await showWelcome(chatId);
}

async function showWelcome(chatId: number) {
  await sendMessage(
    chatId,
    `👋 <b>¡Hola! Soy VoiceQuote.</b>\n\n` +
      `<b>Mandame una nota de voz</b> contándome qué presupuesto querés hacer, y yo te armo el presupuesto editable + el link para mandarle a tu cliente.\n\n` +
      `Tip: hablá natural. Si mencionás varias tareas, las separo en items automáticamente. Los precios los completás vos después en el editor.`,
    {
      inline_keyboard: [
        [{ text: '📋 Ver mis presupuestos', callback_data: 'list_quotes' }],
        [{ text: '❓ Cómo funciona', callback_data: 'help' }],
      ],
    }
  ).catch(() => {});
}

async function listRecentQuotes(chatId: number, telegramUserId: number) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!contractor) {
    await sendMessage(
      chatId,
      `📋 Todavía no tenés presupuestos. Mandame una nota de voz y empezamos.`,
      { inline_keyboard: [[{ text: '🎙️ Grabar nota de voz', url: `${WEB_URL}/` }]] }
    ).catch(() => {});
    return;
  }

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, slug, client_name, status, client_response, created_at, currency')
    .eq('contractor_id', contractor.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!quotes || quotes.length === 0) {
    await sendMessage(
      chatId,
      `📋 Todavía no tenés presupuestos. Mandame una nota de voz y empezamos.`,
      { inline_keyboard: [[{ text: '🎙️ Grabar nota de voz', url: `${WEB_URL}/` }]] }
    ).catch(() => {});
    return;
  }

  const statusIcon: Record<string, string> = {
    draft: '📝',
    shared: '🔗',
    expired: '⏰',
  };
  const responseIcon: Record<string, string> = {
    pending: '',
    accepted: '✅',
    rejected: '❌',
    changes_requested: '💬',
  };

  const buttons: InlineButton[][] = quotes.map((q) => {
    const icon = statusIcon[q.status] || '📄';
    const ri = responseIcon[q.client_response] || '';
    const riSuffix = ri ? ` ${ri}` : '';
    const dateStr = new Date(q.created_at).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
    });
    return [
      {
        text: `${icon} ${q.client_name || 'Sin nombre'} — ${dateStr}${riSuffix}`,
        url: `${WEB_URL}/q/${q.id}`,
      },
    ];
  });

  buttons.push([{ text: '➕ Crear nuevo (mandame un audio)', callback_data: 'create_new' }]);

  await sendMessage(
    chatId,
    `📋 <b>Tus últimos ${quotes.length} presupuestos</b>\n\nTocá uno para abrirlo:`,
    { inline_keyboard: buttons }
  ).catch(() => {});
}

async function handleVoiceNote(
  chatId: number,
  telegramUserId: number,
  isVoice: boolean,
  msg: any,
  fileId: string
) {
  const processingMsg = await sendMessage(
    chatId,
    `🎙️ <b>Procesando tu nota de voz…</b>\n\nEsto puede tardar unos segundos.`
  ).catch(() => null);
  await sendChatAction(chatId, 'typing');

  try {
    const { buffer } = await getFile(fileId);
    const mimeType = isVoice ? 'audio/ogg' : msg.audio?.mime_type || 'audio/mpeg';
    await sendChatAction(chatId, 'record_voice');

    let quoteJson;
    try {
      quoteJson = await audioToQuote(buffer, mimeType);
    } catch (e: any) {
      console.error('[gemini] parse/transcribe error', e?.message || e);
      if (processingMsg?.message_id) {
        await deleteMessage(chatId, processingMsg.message_id);
      }
      await sendMessage(
        chatId,
        `❌ <b>No pude procesar el audio.</b>\n\nProbá de nuevo o mandá los datos por texto. Si sigue fallando, el audio puede tener mucho ruido.`
      ).catch(() => {});
      return;
    }
    await sendChatAction(chatId, 'typing');

    // Find or create contractor
    const { data: existing } = await supabase
      .from('contractors')
      .select('id')
      .eq('telegram_user_id', telegramUserId)
      .single();

    let contractorId = existing?.id;
    if (!contractorId) {
      const { data: created, error } = await supabase
        .from('contractors')
        .insert({ telegram_user_id: telegramUserId })
        .select('id')
        .single();
      if (error) throw error;
      contractorId = created.id;
    }

    // Create quote + items
    const slug = newSlug();
    const validityDays = 15;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        slug,
        client_name: quoteJson.client_name,
        client_contact: quoteJson.client_contact,
        currency: quoteJson.currency || 'USD',
        notes: quoteJson.notes,
        terms: quoteJson.terms,
        validity_days: validityDays,
        expires_at: expiresAt,
        status: 'draft',
        raw_gemini_output: JSON.stringify(quoteJson),
      })
      .select('id')
      .single();
    if (qErr) throw qErr;

    // Default qty=1 for any item with null qty (so the user just fills prices)
    const itemsNormalized = (quoteJson.items || []).map((it) => ({
      description: it.description,
      qty: it.qty === null || it.qty === undefined ? 1 : it.qty,
      unit_price: it.unit_price,
      // Will recompute below
      line_total: 0,
    }));
    if (itemsNormalized.length > 0) {
      const rows = itemsNormalized.map((it, i) => ({
        quote_id: quote.id,
        description: it.description,
        qty: it.qty,
        unit_price: it.unit_price,
        line_total: it.qty && it.unit_price ? it.qty * it.unit_price : 0,
        sort_order: i,
      }));
      const { error: iErr } = await supabase.from('quote_items').insert(rows);
      if (iErr) throw iErr;
    }

    const editUrl = `${WEB_URL}/q/${quote.id}`;
    const client = quoteJson.client_name || 'tu cliente';
    const itemsCount = itemsNormalized.length;
    const missingByItem = groupMissingFields(itemsNormalized, quoteJson.missing_fields || []);

    const itemsLabel = itemsCount === 1 ? '1 item detectado' : `${itemsCount} items detectados`;
    const responseText =
      missingByItem.length > 0
        ? `✅ <b>Listo, armé el presupuesto para ${escapeHtml(client)}.</b>\n\n` +
          `📋 ${itemsLabel}.\n` +
          `⚠️ ${missingByItem.length === 1 ? '1 item necesita' : `${missingByItem.length} items necesitan`} que completes el precio.\n\n` +
          `Tocá el botón para revisar:`
        : `✅ <b>Listo, armé el presupuesto para ${escapeHtml(client)}.</b>\n\n` +
          `📋 ${itemsLabel}, todo en orden.\n\n` +
          `Tocá el botón para revisar y compartir:`;

    const replyMarkup = {
      inline_keyboard: [[{ text: '📝 Editar presupuesto', url: editUrl }]],
    };

    if (processingMsg?.message_id) {
      const ok = await editMessageText(
        chatId,
        processingMsg.message_id,
        responseText,
        replyMarkup
      );
      if (!ok) {
        await sendMessage(chatId, responseText, replyMarkup).catch(() => {});
      }
    } else {
      await sendMessage(chatId, responseText, replyMarkup).catch(() => {});
    }
  } catch (e) {
    console.error('[telegram] handleUpdate error', e);
    if (processingMsg?.message_id) {
      await deleteMessage(chatId, processingMsg.message_id);
    }
    await sendMessage(
      chatId,
      `❌ <b>Hubo un error procesando tu audio.</b>\n\nProbá de nuevo en unos segundos.`
    ).catch(() => {});
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function groupMissingFields(
  items: QuoteJson['items'],
  missingFields: string[]
): Array<{ name: string; missing: string[] }> {
  const groups: Record<number, Set<string>> = {};
  for (const field of missingFields) {
    const m = field.match(/^items\[(\d+)\]\.(\w+)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const human = m[2] === 'qty' ? 'cantidad' : m[2] === 'unit_price' ? 'precio' : m[2];
    if (!groups[idx]) groups[idx] = new Set();
    groups[idx].add(human);
  }
  return Object.entries(groups).map(([idx, fields]) => {
    const item = items[Number(idx)];
    return {
      name: item?.description?.trim() || `Item ${Number(idx) + 1}`,
      missing: Array.from(fields),
    };
  });
}
