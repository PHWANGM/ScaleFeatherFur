import { __setTestDB, query, execute, transaction } from '../../lib/db/db.client';

test('query/execute propagate errors with SQL attached', async () => {
  const badDb = {
    getAllAsync: async () => { throw new Error('boom'); },
    runAsync: async () => { throw new Error('kaboom'); },
    execAsync: async () => {},
    withTransactionAsync: async (fn: any) => { await fn(); },
  } as any;

  __setTestDB(badDb);

  await expect(query('SELECT 1')).rejects.toThrow(/DB query failed:/);
  await expect(execute('INSERT INTO t VALUES (1)')).rejects.toThrow(/DB execute failed:/);
});

test('transaction wraps calls', async () => {
  const calls: string[] = [];
  const fakeDb = {
    getAllAsync: async (sql: string) => { calls.push('get:' + sql); return []; },
    runAsync: async (sql: string)   => { calls.push('run:' + sql); return { changes: 1, lastInsertRowId: 1 }; },
    execAsync: async () => {},
    withTransactionAsync: async (fn: any) => { calls.push('begin'); await fn(); calls.push('commit'); },
  } as any;

  __setTestDB(fakeDb);

  await transaction(async (tx) => {
    await tx.execute('INSERT INTO x VALUES (?)', [1]);
    await tx.query('SELECT * FROM x');
  });

  expect(calls[0]).toBe('begin');
  expect(calls).toContainEqual(expect.stringMatching(/^run:INSERT/));
  expect(calls).toContainEqual(expect.stringMatching(/^get:SELECT/));
  expect(calls.at(-1)).toBe('commit');
});
