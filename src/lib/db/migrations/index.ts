// src/lib/db/migrations/index.ts
import * as FileSystem from 'expo-file-system/legacy'; // ← 你原本的寫法
import { Asset } from 'expo-asset';

/** Migration 項目可來自打包資產（.sql 檔）或內嵌字串（測試、熱修補） */
export type MigrationEntry =
  | ({ name: string } & { asset: any })   // e.g., require('./V1__init.sql')
  | ({ name: string } & { sql: string }); // e.g., 測試直接注入 SQL

/** 正式註冊：以資產檔為主（依「執行順序」排列） */
export const MIGRATIONS: MigrationEntry[] = [
  { name: 'V1__init.sql',                 asset: require('./V1__init.sql') },
  { name: 'V2__care_env_targets.sql',     asset: require('./V2__care_env_targets.sql') },
  { name: 'V2.1__seed_species_targets.sql', asset: require('./V2.1__seed_species_targets.sql') },
];

/** 讀取 Migration 的 SQL 文字 */
export async function readMigrationSql(entry: MigrationEntry): Promise<string> {
  if ('sql' in entry) return entry.sql; // 測試/inline

  const asset = Asset.fromModule(entry.asset);
  await asset.downloadAsync(); // 確保裝置上有本地檔
  const uri = asset.localUri ?? asset.uri;

  // legacy 版 readAsStringAsync，預設 UTF-8
  return FileSystem.readAsStringAsync(uri);
}
