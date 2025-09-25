// src/lib/db/seed/index.ts
import { seedSulcata } from './species.sulcata';
import { seedTasks } from './tasks';
import { seedProducts } from './products';
import { seedArticles } from './articles';

export async function runAllSeeds() {
  await seedSulcata();
  await seedTasks();
  await seedProducts();
  await seedArticles();
}
