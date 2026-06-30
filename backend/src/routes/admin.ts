import { Router, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';

export const adminRouter = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

adminRouter.get('/admin/analytics/summary', async (req: Request, res: Response) => {
  if (!env.ADMIN_TOKEN) {
    return res.status(503).json({ error: 'admin_disabled', message: 'Admin token not configured.' });
  }

  const token = req.header('x-admin-token');
  if (!token || token !== env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    const [
      { data: eventsByType, error: eventsErr },
      { count: quotesTotal, error: quotesErr },
      { count: contractorsTotal, error: contractorsErr },
      { data: responseCounts, error: responseErr },
      { data: last7Days, error: last7Err },
    ] = await Promise.all([
      supabase.from('events').select('event_type'),
      supabase.from('quotes').select('id', { count: 'exact', head: true }),
      supabase.from('contractors').select('id', { count: 'exact', head: true }),
      supabase
        .from('quotes')
        .select('client_response, is_active')
        .in('client_response', ['accepted', 'rejected', 'changes_requested']),
      supabase.from('events').select('event_type, created_at').gte('created_at', since),
    ]);

    if (eventsErr) throw eventsErr;
    if (quotesErr) throw quotesErr;
    if (contractorsErr) throw contractorsErr;
    if (responseErr) throw responseErr;
    if (last7Err) throw last7Err;

    const countsByType: Record<string, number> = {};
    for (const row of eventsByType || []) {
      countsByType[row.event_type] = (countsByType[row.event_type] || 0) + 1;
    }

    const last7Counts: Record<string, number> = {};
    for (const row of last7Days || []) {
      last7Counts[row.event_type] = (last7Counts[row.event_type] || 0) + 1;
    }

    const accepted = (responseCounts || []).filter((r) => r.client_response === 'accepted').length;
    const rejected = (responseCounts || []).filter((r) => r.client_response === 'rejected').length;
    const changesRequested = (responseCounts || []).filter(
      (r) => r.client_response === 'changes_requested'
    ).length;

    res.json({
      counts_by_event_type: countsByType,
      quotes_total: quotesTotal ?? 0,
      contractors_total: contractorsTotal ?? 0,
      accepted,
      rejected,
      changes_requested: changesRequested,
      last_7_days: last7Counts,
    });
  } catch (err: any) {
    console.error('[admin] analytics summary failed', err);
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});
