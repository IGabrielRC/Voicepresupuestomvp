import { supabase } from './supabase.js';

export interface TrackEventInput {
  event_type: string;
  contractor_id?: string | null;
  quote_id?: string | null;
  slug?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort event tracking. Never throws and never blocks the caller.
 * Logs to Supabase public.events using the service-role client.
 */
export function trackEvent(input: TrackEventInput): void {
  // Fire-and-forget: analytics must not delay user-facing operations.
  Promise.resolve(
    supabase
      .from('events')
      .insert({
        event_type: input.event_type,
        contractor_id: input.contractor_id ?? null,
        quote_id: input.quote_id ?? null,
        slug: input.slug ?? null,
        metadata: input.metadata ?? {},
      })
  )
    .then(({ error }) => {
      if (error) {
        console.error('[analytics] trackEvent failed', input.event_type, error);
      }
    })
    .catch((err) => {
      console.error('[analytics] trackEvent exception', input.event_type, err);
    });
}
