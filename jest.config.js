/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
// ★ 關鍵：把 Expo 原生模組映射到我們的測試 mock
  moduleNameMapper: {
    '^expo-sqlite$': '<rootDir>/src/test/mocks/expo-sqlite.ts',
    '^expo-asset$': '<rootDir>/src/test/mocks/expo-asset.ts',
    '^expo-file-system$': '<rootDir>/src/test/mocks/expo-file-system.ts',
// ★ 將 .sql 檔一律映射到 stub
    '\\.sql$': '<rootDir>/src/test/mocks/sql-asset'  
},
};