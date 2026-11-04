module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    // @amane/shared (packages/shared, ESM) est transpilé par Babel : ses helpers se résolvent ici, quel que soit l'emplacement de node_modules.
    '^@babel/runtime/(.*)$': require.resolve('@babel/runtime/package.json').replace(/package\.json$/, '$1'),
    '^@/lib/storage$': '<rootDir>/src/lib/storage.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand|@amane/shared)',
  ],
};
