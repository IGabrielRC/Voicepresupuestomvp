import { env } from '../lib/env.js';

const API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export type InlineButton = { text: string; url?: string; callback_data?: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboard
): Promise<{ message_id: number } | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Telegram sendMessage failed (${res.status}): ${errBody}`);
  }
  const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
  return data.result ?? null;
}

// Best-effort: shows the "typing..." indicator in the chat. Lasts ~5s, call again for longer.
export async function sendChatAction(chatId: number, action: string): Promise<void> {
  try {
    await fetch(`${API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    /* non-critical */
  }
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`[telegram] editMessageText failed: ${await res.text()}`);
    return false;
  }
  return true;
}

export async function deleteMessage(chatId: number, messageId: number): Promise<void> {
  try {
    await fetch(`${API}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch {
    /* non-critical */
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(`${API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {
    /* non-critical */
  }
}

export async function getFile(fileId: string): Promise<{ buffer: Buffer }> {
  const metaRes = await fetch(`${API}/getFile?file_id=${fileId}`);
  if (!metaRes.ok) throw new Error(`Telegram getFile meta failed: ${await metaRes.text()}`);
  const meta = (await metaRes.json()) as { ok: boolean; result?: { file_path: string }; description?: string };
  if (!meta.ok || !meta.result?.file_path) {
    throw new Error(`Telegram getFile not ok: ${JSON.stringify(meta)}`);
  }
  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Telegram file download failed: ${fileRes.status}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer) };
}
