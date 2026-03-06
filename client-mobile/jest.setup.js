/**
 * jest.setup.js
 *
 * Runs before each test file (via `setupFiles` in jest.config.js).
 *
 * Purpose:
 *  1. Provides a stub export for Expo's ImportMetaRegistry/polyfill modules
 *     that use `import.meta` — a native ESM feature unavailable in Jest's
 *     CommonJS/Node runtime.
 *  2. Pre-registers those modules via jest.mock() so any `require()` of them
 *     returns the stub immediately, before test code even runs.
 *
 * Without this file the test suite crashes with:
 *   "ReferenceError: You are trying to import a file outside of the scope
 *    of the test code."
 * ...from node_modules/expo/src/winter/runtime.native.ts when Expo's global
 * polyfill installer (`installGlobal`) lazily bootstraps `structuredClone`
 * and `__ExpoImportMetaRegistry`.
 */

// Provide minimal stubs that satisfy any code reading these modules' exports.
const stub = { ImportMetaRegistry: {}, default: function structuredClone(v) { return v; } };

// Register the stubs before test modules are loaded.
// jest.mock() hoisting doesn't apply in setupFiles, so we use setMock().
if (typeof jest !== 'undefined') {
    jest.setMock('expo/src/winter/ImportMetaRegistry', stub);
    jest.setMock('@ungap/structured-clone', stub);
}

// Also pre-define the global that Expo's installGlobal reads, so if the lazy
// getter fires before our setMock takes effect it gets a no-op value.
if (typeof globalThis.__ExpoImportMetaRegistry === 'undefined') {
    globalThis.__ExpoImportMetaRegistry = {};
}
if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}
