// src/lib/time/week.ts

export type WeekRangeOptions = {
  /** 'local' 使用 getDay()/setHours(); 'utc' 使用 getUTCDay()/setUTCHours() */
  mode?: 'local' | 'utc';
  /** 週起始日：0=Sun, 1=Mon(預設), ..., 6=Sat */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

/**
 * 回傳包含 dateISO 的那一週 [startISO, endISO)
 * - 預設以「週一 00:00」為起點
 * - mode='local'：用裝置時區計算並輸出 ISO（UTC 標準字串）
 * - mode='utc'：以 UTC 為準計算週界線
 */
export function getWeekRangeContaining(
  dateISO: string,
  opts: WeekRangeOptions = {}
): { startISO: string; endISO: string } {
  const mode = opts.mode ?? 'local';
  const weekStartsOn = opts.weekStartsOn ?? 1; // Monday

  const d = new Date(dateISO);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date ISO: ${dateISO}`);
  }

  // 取當天是週幾（依 mode）
  const dayOfWeek =
    mode === 'utc'
      ? d.getUTCDay()           // 0..6
      : d.getDay();             // 0..6

  // 算出與 "週起始日" 的距離
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;

  // 取得「週起始日 00:00」
  const start = new Date(d);
  if (mode === 'utc') {
    // 先回到當天 00:00 UTC
    start.setUTCHours(0, 0, 0, 0);
    // 再回推到該週起始
    start.setUTCDate(start.getUTCDate() - diff);
  } else {
    // Local 模式：先回到當天本地 00:00
    start.setHours(0, 0, 0, 0);
    // 再回推到該週起始
    start.setDate(start.getDate() - diff);
  }

  // end = start + 7 天（[start, end) 慣例）
  const end = new Date(start);
  if (mode === 'utc') {
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    end.setDate(end.getDate() + 7);
  }

  // 輸出 ISO（toISOString 一律輸出 UTC 標準字串）
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

/** 取本週（以現在時間為基準） */
export function getThisWeekRange(opts: WeekRangeOptions = {}): { startISO: string; endISO: string } {
  return getWeekRangeContaining(new Date().toISOString(), opts);
}
