module.exports = {
    testEnvironment: "jsdom",
    transform: { "^.+\\.[tj]sx?$": "babel-jest" },
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    moduleFileExtensions: ["js", "jsx"],
  };
  