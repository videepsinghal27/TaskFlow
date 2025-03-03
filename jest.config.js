module.exports = {
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  moduleDirectories: ["node_modules", "src"],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  testEnvironment: "jsdom", // ✅ Ensure JSDOM is used
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"], // ✅ Ensure setup file runs
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
  globals: {
      TextEncoder: require("util").TextEncoder, // ✅ Ensures TextEncoder is always available
      TextDecoder: require("util").TextDecoder
  }
};
