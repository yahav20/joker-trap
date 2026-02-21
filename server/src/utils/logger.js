/**
 * logger.js
 * Lightweight tagged logger. Keeps all console output uniform and easy to mute.
 * In future, swap console.* calls with a real logging library (e.g. winston)
 * without touching game logic files.
 */

const COLORS = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
};

function tag(label, color) {
    return `${color}[${label}]${COLORS.reset}`;
}

const logger = {
    /** General server info */
    info(msg) { console.log(`${tag("INFO", COLORS.cyan)}   ${msg}`); },

    /** Game-level events (turn advance, transfers) */
    game(msg) { console.log(`${tag("GAME", COLORS.green)}   ${msg}`); },

    /** Warnings (edge cases, missing ranks) */
    warn(msg) { console.warn(`${tag("WARN", COLORS.yellow)}   ${msg}`); },

    /** Errors (bad input, wrong phase) */
    error(msg) { console.error(`${tag("ERROR", COLORS.red)}  ${msg}`); },

    /** Verbose debug (disabled in production) */
    debug(msg) {
        if (process.env.DEBUG) {
            console.log(`${tag("DEBUG", COLORS.gray)}  ${msg}`);
        }
    },
};

module.exports = logger;
