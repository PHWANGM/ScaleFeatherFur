import {
  __setTestDB,
  execute,
  query,
  transaction,
} from "../../lib/db/db.client"

type TestDb = Parameters<typeof __setTestDB>[0]

test("query/execute propagate errors with SQL attached", async () => {
  const badDb = {
    getAllAsync: () => {
      throw new Error("boom")
    },
    runAsync: () => {
      throw new Error("kaboom")
    },
    execAsync: async () => {},
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn()
    },
  } as unknown as TestDb

  __setTestDB(badDb)

  await expect(query("SELECT 1")).rejects.toThrow(/DB query failed:/)
  await expect(execute("INSERT INTO t VALUES (1)")).rejects.toThrow(
    /DB execute failed:/,
  )
})

test("transaction wraps calls", async () => {
  const calls: string[] = []
  const fakeDb = {
    getAllAsync: (sql: string) => {
      calls.push("get:" + sql)
      return []
    },
    runAsync: (sql: string) => {
      calls.push("run:" + sql)
      return { changes: 1, lastInsertRowId: 1 }
    },
    execAsync: async () => {},
    withTransactionAsync: async (fn: () => Promise<void>) => {
      calls.push("begin")
      await fn()
      calls.push("commit")
    },
  } as unknown as TestDb

  __setTestDB(fakeDb)

  await transaction(async (tx) => {
    await tx.execute("INSERT INTO x VALUES (?)", [1])
    await tx.query("SELECT * FROM x")
  })

  expect(calls[0]).toBe("begin")
  expect(calls).toContainEqual(expect.stringMatching(/^run:INSERT/))
  expect(calls).toContainEqual(expect.stringMatching(/^get:SELECT/))
  expect(calls.at(-1)).toBe("commit")
})
