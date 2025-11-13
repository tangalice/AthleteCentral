import "@testing-library/jest-dom";
import { expect } from "@jest/globals";

global.fetch = require("node-fetch");

class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = value.toString();
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();
global.window = global;
global.document = {
  createElement: () => ({}),
};

// ✅ Make expect globally available for jest-dom
global.expect = expect;
