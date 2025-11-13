module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest",
  },
  moduleFileExtensions: ["js", "jsx"],
  testMatch: ["<rootDir>/src/unit test/**/*.test.jsx"], // ✅ 只运行 unit test 文件夹下的测试
};
