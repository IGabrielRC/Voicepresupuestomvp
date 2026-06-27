import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  WEB_BASE_URL: process.env.WEB_BASE_URL || 'http://localhost:5173',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
};
