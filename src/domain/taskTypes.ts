// 統一任務型別與型別守門（narrowing）
export const TASK_TYPES = ['feed','calcium','uvb_on','uvb_off','clean','weigh'] as const;
export type TaskType = typeof TASK_TYPES[number];

/** 若輸入是 string（例如來自路由/輸入框/外部資料），用此函式窄化成 TaskType */
export function asTaskType(v: string | undefined | null): TaskType | undefined {
  if (!v) return undefined;
  return (TASK_TYPES as readonly string[]).includes(v) ? (v as TaskType) : undefined;
}
