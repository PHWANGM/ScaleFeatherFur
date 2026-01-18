-- V4__outbox.sql
-- Local sync outbox (SQLite)
-- Store offline events that need to be synced to Supabase later.

create table if not exists sync_outbox (
  id text primary key,
  type text not null,              -- e.g. 'task_complete'
  payload_json text not null,      -- JSON string
  created_at text not null,        -- ISO string
  synced_at text,                  -- ISO string when synced
  tries integer not null default 0,
  last_error text
);

create index if not exists idx_sync_outbox_unsynced_created
on sync_outbox(synced_at, created_at);

create index if not exists idx_sync_outbox_type_created
on sync_outbox(type, created_at);
