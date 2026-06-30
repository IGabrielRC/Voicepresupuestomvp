-- Track public quote views for the "open receipt" Telegram notification.

alter table quotes
  add column if not exists viewed_at timestamptz default null,
  add column if not exists view_count int default 0;

-- Ensure existing rows have a non-null counter.
update quotes set view_count = 0 where view_count is null;
