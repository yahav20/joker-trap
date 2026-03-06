module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
    ],
    /**
     * Stub out ESM-only modules that use `import.meta`, which is unavailable in
     * the Node.js CommonJS environment Jest uses. Without these stubs Expo's
     * winter runtime crashes when @testing-library/react-native bootstraps.
     */
    moduleNameMapper: {
        'expo/src/winter/ImportMetaRegistry': '<rootDir>/jest.setup.js',
        '@ungap/structured-clone': '<rootDir>/jest.setup.js',
    },
    setupFiles: ['./jest.setup.js'],
};
