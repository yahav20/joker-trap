const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * When bundling for iOS / Android, Metro still tries to resolve
 * @lottiefiles/dotlottie-react that is imported inside
 * lottie-react-native/lib/module/LottieView/index.web.js.
 *
 * That package is a DOM-only React library and does not need to
 * be shipped in a native build. We intercept the import here and
 * return an { type: 'empty' } stub so Metro skips it silently.
 */
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
        moduleName === '@lottiefiles/dotlottie-react' &&
        platform !== 'web'
    ) {
        // Return an empty module — the native Lottie renderer doesn't
        // use this package; only the web renderer does.
        return { type: 'empty' };
    }

    // Fall back to the default resolver for everything else.
    return originalResolveRequest
        ? originalResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
