import { Router, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { trackEvent } from '../lib/analytics.js';
import { audioToQuote, type QuoteJson } from '../services/gemini.js';
import {
  getFile,
  sendMessage,
  sendChatAction,
  editMessageText,
  deleteMessage,
  answerCallbackQuery,
  type InlineButton,
  type ReplyKeyboardMarkup,
} from '../services/telegram.js';
import { newSlug } from '../services/slug.js';
import { newEditToken } from '../services/token.js';
import { checkAudioRateLimit } from '../middleware/rateLimit.js';

export const telegramRouter = Router();

const WEB_URL = env.WEB_BASE_URL;

// Mobile-first persistent reply keyboard. Tapping a button acts like a command.
const MAIN_MENU_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '📋 Mis presupuestos' }, { text: '📊 Stats' }],
    [{ text: '👤 Mi perfil' }, { text: '❓ Ayuda' }],
  ],
  resize_keyboard: true,
};

const CREATE_BUTTON_KEYBOARD: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '➕ Crear presupuesto' }, { text: '🎙️ Grabar nota de voz' }],
    [{ text: '📋 Mis presupuestos' }, { text: '❓ Ayuda' }],
  ],
  resize_keyboard: true,
};

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

  // Rate limit: max 1 audio every 5s per user. Prevents Gemini bill abuse.
  if (!checkAudioRateLimit(telegramUserId)) {
    await sendMessage(
      chatId,
      `⏱️ <b>Esperá unos segundos entre audios.</b>\n\nEsto es para evitar abuso y mantener el servicio estable para todos.`
    ).catch(() => {});
    return;
  }

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
    await sendHelp(chatId);
    return;
  }

  if (data === 'create_new' || data === 'record_voice') {
    await sendMessage(
      chatId,
      `Envíame una <b>nota de voz</b> contando el presupuesto. ` +
        `Te paso el link al editor en unos segundos. 🎙️`,
      CREATE_BUTTON_KEYBOARD
    ).catch(() => {});
    return;
  }
}

async function handleTextCommand(chatId: number, telegramUserId: number, text: string) {
  const cmd = text.trim().toLowerCase();

  if (cmd === '/start') {
    await showWelcome(chatId, telegramUserId);
    return;
  }

  if (cmd === '➕ crear presupuesto' || cmd === '🎙️ grabar nota de voz') {
    await sendMessage(
      chatId,
      `Envíame una <b>nota de voz</b> contando el presupuesto. ` + `Te paso el link al editor en unos segundos. 🎙️`,
      CREATE_BUTTON_KEYBOARD
    ).catch(() => {});
    return;
  }

  if (cmd === '/quotes' || cmd === '📋 mis presupuestos') {
    await listRecentQuotes(chatId, telegramUserId);
    return;
  }

  if (cmd === '/stats' || cmd === '📊 stats') {
    await showStats(chatId, telegramUserId);
    return;
  }

  if (cmd === '/profile' || cmd === '👤 mi perfil') {
    await showProfile(chatId, telegramUserId);
    return;
  }

  if (cmd === '/help' || cmd === '❓ ayuda') {
    await sendHelp(chatId);
    return;
  }

  // ANY other text: auto-welcome. Don't be a "command-only" bot.
  await showWelcome(chatId, telegramUserId);
}

async function showWelcome(chatId: number, telegramUserId?: number) {
  let latestQuoteText = '';
  if (telegramUserId) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('id')
      .eq('telegram_user_id', telegramUserId)
      .single();
    if (contractor) {
      const { data: latest } = await supabase
        .from('quotes')
        .select('client_name, status, client_response, created_at')
        .eq('contractor_id', contractor.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        const statusLabels: Record<string, string> = {
          draft: 'Borrador',
          shared: 'Compartido',
          expired: 'Expirado',
        };
        const responseLabels: Record<string, string> = {
          pending: 'pendiente',
          accepted: 'aceptado',
          rejected: 'rechazado',
          changes_requested: 'cambios pedidos',
        };
        const client = latest.client_name || 'Sin nombre';
        const status = statusLabels[latest.status] || latest.status;
        const response = responseLabels[latest.client_response] || latest.client_response;
        latestQuoteText = `\n\n📋 Último presupuesto: <b>${escapeHtml(client)}</b> — ${status} · ${response}`;
      }
    }
  }

  await sendMessage(
    chatId,
    `👋 <b>¡Hola! Soy PresupuestoYA.</b>\n\n` +
      `<b>Toca un botón o envíame una nota de voz</b> para armar un presupuesto. Yo te paso el link editable para tu cliente.\n\n` +
      `Tip: habla natural. Separo en items automáticamente y tú completas los precios en el editor.` +
      latestQuoteText,
    MAIN_MENU_KEYBOARD
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
      `📋 Todavía no tienes presupuestos. Envíame una nota de voz y empezamos.`,
      CREATE_BUTTON_KEYBOARD
    ).catch(() => {});
    return;
  }

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, slug, client_name, status, client_response, created_at, currency, edit_token')
    .eq('contractor_id', contractor.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!quotes || quotes.length === 0) {
    await sendMessage(
      chatId,
      `📋 Todavía no tienes presupuestos. Envíame una nota de voz y empezamos.`,
      CREATE_BUTTON_KEYBOARD
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
    const dateStr = new Date(q.created_at).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
    });
    return [
      {
        text: `${icon} ${q.client_name || 'Sin nombre'} — ${dateStr}${riSuffix}`,
        url: `${WEB_URL}/q/${q.id}?t=${q.edit_token}`,
      },
    ];
  });

  buttons.push([{ text: '➕ Crear nuevo (envíame un audio)', callback_data: 'create_new' }]);

  await sendMessage(
    chatId,
    `📋 <b>Tus últimos ${quotes.length} presupuestos</b>\n\nToca uno para abrirlo:`,
    { inline_keyboard: buttons }
  ).catch(() => {});
}

async function sendHelp(chatId: number) {
  await sendMessage(
    chatId,
    `<b>Cómo usar PresupuestoYA</b>\n\n` +
      `1. Toca <b>🎙️ Grabar nota de voz</b> y envíame el audio con los items.\n` +
      `2. Yo te paso el link para revisar y editar.\n` +
      `3. Cuando esté listo, compártelo desde el editor.\n` +
      `4. Tu cliente abre el link y acepta, rechaza o pide cambios.\n` +
      `5. Te aviso por aquí.\n\n` +
      `<b>Comandos:</b>\n/start — bienvenida\n/quotes — tus presupuestos\n/stats — tus números\n/profile — tu perfil\n/help — este mensaje`,
    MAIN_MENU_KEYBOARD
  ).catch(() => {});
}

async function showStats(chatId: number, telegramUserId: number) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!contractor) {
    await sendMessage(
      chatId,
      `📊 Todavía no tienes estadísticas. Envíame una nota de voz y empezamos.`,
      CREATE_BUTTON_KEYBOARD
    ).catch(() => {});
    return;
  }

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('status, client_response, is_active')
    .eq('contractor_id', contractor.id);

  if (error) {
    await sendMessage(chatId, `❌ No pude cargar tus estadísticas. Prueba de nuevo.`, MAIN_MENU_KEYBOARD).catch(
      () => {}
    );
    return;
  }

  const all = quotes || [];
  const shared = all.filter((q) => q.status === 'shared').length;
  const accepted = all.filter((q) => q.client_response === 'accepted').length;
  const rejected = all.filter((q) => q.client_response === 'rejected').length;
  const pending = all.filter((q) => q.client_response === 'pending' && q.status === 'shared').length;
  const changesRequested = all.filter((q) => q.client_response === 'changes_requested').length;
  const rate = shared > 0 ? Math.round((accepted / shared) * 100) : 0;

  await sendMessage(
    chatId,
    `📊 <b>Tus números</b>\n\n` +
      `📤 Enviados / compartidos: <b>${shared}</b>\n` +
      `✅ Aceptados: <b>${accepted}</b> (${rate}%)\n` +
      `⏳ Pendientes: <b>${pending}</b>\n` +
      `❌ Rechazados: <b>${rejected}</b>\n` +
      `💬 Cambios pedidos: <b>${changesRequested}</b>`,
    {
      inline_keyboard: [[{ text: '📋 Ver presupuestos', callback_data: 'list_quotes' }]],
    }
  ).catch(() => {});
}

async function showProfile(chatId: number, telegramUserId: number) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!contractor) {
    await sendMessage(
      chatId,
      `👤 Tu perfil se habilita después del primer presupuesto. Envíame una nota de voz y lo creamos.`,
      CREATE_BUTTON_KEYBOARD
    ).catch(() => {});
    return;
  }

  const { data: latest } = await supabase
    .from('quotes')
    .select('id, edit_token')
    .eq('contractor_id', contractor.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.edit_token) {
    const profileUrl = `${WEB_URL}/p/${contractor.id}?t=${latest.edit_token}`;
    await sendMessage(
      chatId,
      `👤 <b>Tu perfil</b>\n\nEdita tu nombre de empresa, logo y contacto para que los presupuestos se vean profesionales.`,
      {
        inline_keyboard: [[{ text: '✏️ Editar perfil', url: profileUrl }]],
      }
    ).catch(() => {});
    return;
  }

  await sendMessage(
    chatId,
      `👤 Tu perfil se habilita después del primer presupuesto. Envíame una nota de voz y lo creamos.`,
    CREATE_BUTTON_KEYBOARD
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
        `❌ <b>No pude procesar el audio.</b>\n\nPrueba de nuevo o envía los datos por texto. Si sigue fallando, el audio puede tener mucho ruido.`
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
    const editToken = newEditToken();
    const validityDays = 3;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        slug,
        edit_token: editToken,
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
      .select('id, edit_token')
      .single();
    if (qErr) throw qErr;

    // Track the slug so public links resolve through quote_slugs history.
    const { error: slugErr } = await supabase.from('quote_slugs').insert({
      slug,
      quote_id: quote.id,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    if (slugErr) console.error('[telegram] quote_slugs insert failed', slugErr);

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

    trackEvent({
      event_type: 'quote_created',
      contractor_id: contractorId,
      quote_id: quote.id,
      slug,
      metadata: { source: 'telegram_voice', items_count: itemsNormalized.length },
    });

    const editUrl = `${WEB_URL}/q/${quote.id}?t=${quote.edit_token}`;
    const client = quoteJson.client_name || 'tu cliente';
    const itemsCount = itemsNormalized.length;
    const missingByItem = groupMissingFields(itemsNormalized, quoteJson.missing_fields || []);

    const itemsLabel = itemsCount === 1 ? '1 item detectado' : `${itemsCount} items detectados`;
    const responseText =
      missingByItem.length > 0
        ? `✅ <b>Listo, armé el presupuesto para ${escapeHtml(client)}.</b>\n\n` +
          `📋 ${itemsLabel}.\n` +
          `⚠️ ${missingByItem.length === 1 ? '1 item necesita' : `${missingByItem.length} items necesitan`} que completes el precio.\n\n` +
          `Toca el botón para revisar:`
        : `✅ <b>Listo, armé el presupuesto para ${escapeHtml(client)}.</b>\n\n` +
          `📋 ${itemsLabel}, todo en orden.\n\n` +
          `Toca el botón para revisar y compartir:`;

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

    // Onboarding: if the contractor doesn't have a profile yet, send them a
    // setup link as a follow-up message. This only fires on the first quote
    // (subsequent quotes have a profile).
    const { data: existingProfile } = await supabase
      .from('contractor_profiles')
      .select('business_name')
      .eq('contractor_id', contractorId)
      .maybeSingle();

    if (!existingProfile?.business_name) {
      const profileUrl = `${WEB_URL}/p/${contractorId}?welcome=1`;
      await sendMessage(
        chatId,
        `👤 <b>Mientras tanto, completa tu perfil</b> para que tus presupuestos se vean profesionales (con tu nombre de empresa, logo y contacto).\n\nToca el botón:`,
        {
          inline_keyboard: [
            [{ text: '👤 Configurar mi perfil', url: profileUrl }],
          ],
        }
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[telegram] handleUpdate error', e);
    if (processingMsg?.message_id) {
      await deleteMessage(chatId, processingMsg.message_id);
    }
    await sendMessage(
      chatId,
      `❌ <b>Hubo un error procesando tu audio.</b>\n\nPrueba de nuevo en unos segundos.`
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
