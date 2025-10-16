// src/lib/db/migrations/index.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

/** Migration 項目可來自打包資產（.sql 檔）或內嵌字串（測試、熱修補） */
export type MigrationEntry =
  | ({ name: string } & { asset: any })   // 例如 require('./V1__init.sql')
  | ({ name: string } & { sql: string }); // 若直接內嵌 SQL 文字（測試用）

/** 正式註冊：依執行順序排列 */
export const MIGRATIONS: MigrationEntry[] = [
  { name: 'V1__init.sql', asset: require('./V1__init.sql') },
  { name: 'V2__seed_species_targets.sql', asset: require('./V2__seed_species_targets.sql') },
  { name: 'V3__seed_species.sql', asset: require('./V3__seed_species.sql') },
];

/** 讀取 Migration 的 SQL 文字 */
export async function readMigrationSql(entry: MigrationEntry): Promise<string> {
  if ('sql' in entry) return entry.sql; // 測試 / inline 模式
  const asset = Asset.fromModule(entry.asset);
  await asset.downloadAsync(); // 確保有本地副本
  const uri = asset.localUri ?? asset.uri;
  return FileSystem.readAsStringAsync(uri); // UTF-8
}
