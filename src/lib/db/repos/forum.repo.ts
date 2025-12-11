// src/db/repos/forum.repo.ts
import { query, execute } from '../db.client';

export type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  tags: string | null;
  affiliate_url: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
};

export type ArticleRow = {
  id: string;
  title: string;
  body_md: string;
  species_key: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

function generateId(prefix: string): string {
  return (
    prefix +
    '_' +
    Math.random().toString(36).slice(2) +
    '_' +
    Date.now().toString(36)
  );
}

// Products

export async function createProduct(input: {
  name: string;
  brand?: string | null;
  tags?: string | null;
  affiliate_url?: string | null;
  region?: string | null;
}): Promise<ProductRow> {
  const now = new Date().toISOString();
  const id = generateId('prod');

  await execute(
    `INSERT INTO products (id, name, brand, tags, affiliate_url, region, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.brand ?? null,
      input.tags ?? null,
      input.affiliate_url ?? null,
      input.region ?? null,
      now,
      now,
    ]
  );

  const rows = await query<ProductRow>(
    `SELECT * FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0]!;
}

export function getAllProducts(): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT * FROM products ORDER BY datetime(created_at) DESC`,
    []
  );
}

export function getProductsByBrand(brand: string): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT * FROM products WHERE brand = ? ORDER BY datetime(created_at) DESC`,
    [brand]
  );
}

// Articles (PetForum 用)

export async function createArticle(input: {
  title: string;
  body_md: string;
  species_key?: string | null;
  tags?: string | null;  // 放 imageUrl / productLink / likes 的 JSON
}): Promise<ArticleRow> {
  const now = new Date().toISOString();
  const id = generateId('art');

  await execute(
    `INSERT INTO articles (id, title, body_md, species_key, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.body_md,
      input.species_key ?? null,
      input.tags ?? null,
      now,
      now,
    ]
  );

  const rows = await query<ArticleRow>(
    `SELECT * FROM articles WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0]!;
}

export function getAllArticles(): Promise<ArticleRow[]> {
  return query<ArticleRow>(
    `SELECT id, title, body_md, species_key, tags, created_at, updated_at
     FROM articles
     ORDER BY datetime(created_at) DESC`,
    []
  );
}

export function getArticlesBySpecies(speciesKey: string): Promise<ArticleRow[]> {
  return query<ArticleRow>(
    `SELECT id, title, body_md, species_key, tags, created_at, updated_at
     FROM articles
     WHERE species_key = ?
     ORDER BY datetime(created_at) DESC`,
    [speciesKey]
  );
}
