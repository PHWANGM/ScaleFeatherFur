// src/test/mocks/expo-asset.ts
export class Asset {
  static fromModule(_mod: unknown) {
    return {
      downloaded: true,
      localUri: "mock://migration.sql",
      uri: "mock://migration.sql",
      async downloadAsync() {/* no-op */},
    }
  }
}
