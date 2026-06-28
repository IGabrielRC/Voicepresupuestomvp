// Simple in-memory rate limiters. For MVP, no need for Redis.
// Resets on process restart — that's fine for our scale.

const lastAudioByUser = new Map<number, number>();
const AUDIO_COOLDOWN_MS = 5_000; // 5 seconds between audio notes per Telegram user

const lastPatchByIp = new Map<string, number>();
const PATCH_COOLDOWN_MS = 1_000; // 1 second between PATCH calls per IP

export function checkAudioRateLimit(telegramUserId: number): boolean {
  const now = Date.now();
  const last = lastAudioByUser.get(telegramUserId);
  if (last && now - last < AUDIO_COOLDOWN_MS) {
    return false;
  }
  lastAudioByUser.set(telegramUserId, now);
  // GC old entries occasionally to avoid unbounded memory
  if (lastAudioByUser.size > 10_000) {
    for (const [k, v] of lastAudioByUser) {
      if (now - v > AUDIO_COOLDOWN_MS * 10) lastAudioByUser.delete(k);
    }
  }
  return true;
}

export function checkPatchRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = lastPatchByIp.get(ip);
  if (last && now - last < PATCH_COOLDOWN_MS) {
    return false;
  }
  lastPatchByIp.set(ip, now);
  if (lastPatchByIp.size > 10_000) {
    for (const [k, v] of lastPatchByIp) {
      if (now - v > PATCH_COOLDOWN_MS * 10) lastPatchByIp.delete(k);
    }
  }
  return true;
}
