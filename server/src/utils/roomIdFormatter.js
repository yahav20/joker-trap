/**
 * roomIdFormatter.js
 * Utility to generate simple alphanumeric room codes.
 */

/**
 * Generates a random alphanumeric string of the specified length.
 * Excludes ambiguous characters like 'O', '0', 'I', '1'.
 *
 * @param {number} length
 * @returns {string}
 */
function generateRoomCode(length = 5) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

module.exports = { generateRoomCode };
