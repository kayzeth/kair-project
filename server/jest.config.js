module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/__tests__/**',
    '!server/index.js',
    '!server/config/**',
  ],
  coverageDirectory: 'server-coverage',
  coverageReporters: ['json', 'lcov', 'text-summary', 'html'],
  testMatch: ['**/server/__tests__/**/*.test.js'],
  verbose: true,
  rootDir: '../',
  transform: {
    '^.+\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@fortawesome)/)',
  ],
};
