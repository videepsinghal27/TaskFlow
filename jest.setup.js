// Jest setup file - Ensures test environment is properly configured
jest.setTimeout(10000); // Set timeout for async tests

import { TextEncoder, TextDecoder } from 'util';

// ✅ Define TextEncoder and TextDecoder globally before JSDOM is imported
if (typeof global.TextEncoder === "undefined") {
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
    global.TextDecoder = TextDecoder;
}

// ✅ Now, import JSDOM only after setting up TextEncoder
import { JSDOM } from "jsdom";

// Create a basic document structure
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    url: "http://localhost",
    pretendToBeVisual: true
});

// Assign necessary globals
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock localStorage and sessionStorage
global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value.toString(); },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

global.sessionStorage = { ...global.localStorage };

// Mock requestAnimationFrame (for UI-related tests)
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

// Mock fetch if needed
if (!global.fetch) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            json: () => Promise.resolve({})
        })
    );
}
