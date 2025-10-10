// src/lib/db/repos/_helpers.ts
import { execute, query, type SQLParams } from '../db.client';

export type ISODate = string;

export function nowIso(): ISODate {
  return new Date().toISOString();
}

/** 安全組裝 UPDATE SET 子句 */
export function buildSetClause(patch: Record<string, unknown>): {
  sql: string;
  params: SQLParams;
} {
  const entries = Object.entries(patch).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) {
    throw new Error('Nothing to update');
  }
  const cols = entries.map(([k], i) => `${k} = ?`).join(', ');
  const params = entries.map(([_, v]) => v as any);
  return { sql: cols, params };
}

/** 以 FK 檢查/或直接依賴 SQLite FK 觸發錯誤；此函式可做 pre-check（非必要） */
export async function existsBy<T = { n: number }>(sql: string, params: SQLParams = []): Promise<boolean> {
  const rows = await query<T & { n: number }>(sql, params);
  return (rows[0]?.n ?? 0) > 0;
}

/** 允許使用 Web Crypto 的 UUID；若環境不支援，退回簡易隨機字串 */
export function genId(prefix: string): string {
  try {
    // @ts-ignore
    const id = crypto?.randomUUID?.();
    if (id) return id;
  } catch {}
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function dayRangeIso(dateStr?: string): { dayStartISO: string; dayEndISO: string } {
  const base = dateStr && dateStr.length >= 10
    ? new Date(`${dateStr}T00:00:00.000Z`)
    : new Date();

  const dayStart = new Date(base);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return {
    dayStartISO: dayStart.toISOString(),
    dayEndISO: dayEnd.toISOString(),
  };
}
