/**
 * EventHive Profanity Filter
 * Client-side profanity detection with Filipino + English word lists
 * and leet speak normalization
 */

// ============================================================
// LEET SPEAK NORMALIZATION MAP
// ============================================================
const LEET_MAP = {
    '0': 'o',
    '1': 'i',
    '2': 'z',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '6': 'g',
    '7': 't',
    '8': 'b',
    '9': 'g',
    '@': 'a',
    '$': 's',
    '!': 'i',
    '+': 't',
    '|': 'i',
    '(': 'c',
    '<': 'c',
    '{': 'c',
    '[': 'c',
    ')': 'd',
    '>': 'd',
    '}': 'd',
    ']': 'd',
    '€': 'e',
    '£': 'l',
    '¥': 'y',
    '©': 'c',
    '®': 'r',
    '™': 'tm',
    'ñ': 'n',
    'Ñ': 'n'
};

// ============================================================
// FILIPINO PROFANITY LIST
// Based on common Filipino/Tagalog profanity
// ============================================================
const FILIPINO_WORDS = [
    // Common Filipino profanity (censored for code readability)
    'putangina', 'putang ina', 'puta', 'tangina', 'tang ina',
    'gago', 'gaga', 'bobo', 'boba', 'tanga', 'ulol', 'inutil',
    'tarantado', 'hayop', 'leche', 'punyeta', 'pakyu', 'pakyo',
    'kupal', 'bwisit', 'siraulo', 'engot', 'peste', 'hinayupak',
    'hudas', 'demonyo', 'satanas', 'walanghiya', 'walang hiya',
    'gunggong', 'ungas', 'olol', 'pakshet', 'puta ka',
    'kingina', 'kinginamo', 'p*ta', 'p*tangina', 'g*go',
    'pukingina', 'pukinangina', 'putragis', 'pucha', 'paksit',
    'kantot', 'kantutan', 'iyot', 'iyutan', 'jakol', 'jabol',
    'tite', 'tamod', 'puke', 'pepe', 'betlog', 'bayag',
    'burat', 'titi', 'pekpek', 'kinantot', 'karat', 'malibog',
    'pokpok', 'patutot', 'kabit', 'pampam', 'malandi'
];

// ============================================================
// ENGLISH PROFANITY LIST
// Common English profanity words
// ============================================================
const ENGLISH_WORDS = [
    // Major profanity
    'fuck', 'fucker', 'fucking', 'fucked', 'fck', 'fuk', 'fuc',
    'shit', 'shitty', 'bullshit', 'horseshit', 'sht',
    'ass', 'asshole', 'dumbass', 'jackass', 'badass',
    'bitch', 'bitchy', 'son of a bitch', 'btch',
    'damn', 'goddamn', 'dammit',
    'crap', 'crappy',
    'bastard', 'moron', 'idiot', 'stupid',
    'dick', 'dickhead', 'dck',
    'cock', 'cunt', 'pussy', 'twat',
    'whore', 'slut', 'hoe', 'thot',
    // Slurs and hate speech (abbreviated for safety)
    'nigger', 'nigga', 'n1gger', 'n1gga',
    'faggot', 'fag', 'f4g',
    'retard', 'retarded'
];

// ============================================================
// COMBINED WORD LIST
// ============================================================
const PROFANITY_LIST = [...FILIPINO_WORDS, ...ENGLISH_WORDS];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize text by converting leet speak to regular letters
 * @param {string} text - Input text
 * @returns {string} - Normalized text
 */
function normalizeLeetSpeak(text) {
    if (!text) return '';

    let normalized = text.toLowerCase();

    // Replace leet characters
    for (const [leet, letter] of Object.entries(LEET_MAP)) {
        // Escape special regex characters
        const escaped = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        normalized = normalized.replace(new RegExp(escaped, 'g'), letter);
    }

    // Remove repeated characters (e.g., "fuuuuck" -> "fuck")
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // Remove common separators used to bypass filters
    normalized = normalized.replace(/[\s\-_\.\/\\*]+/g, '');

    return normalized;
}

/**
 * Check if text contains profanity
 * @param {string} text - Text to check
 * @returns {{hasProfanity: boolean, flaggedWords: string[], normalizedText: string}}
 */
function checkProfanity(text) {
    if (!text || typeof text !== 'string') {
        return { hasProfanity: false, flaggedWords: [], normalizedText: '' };
    }

    const normalizedText = normalizeLeetSpeak(text);
    const flaggedWords = [];

    for (const word of PROFANITY_LIST) {
        const normalizedWord = normalizeLeetSpeak(word);

        // Check if the normalized text contains the profanity word
        if (normalizedText.includes(normalizedWord)) {
            flaggedWords.push(word);
        }
    }

    // Remove duplicates
    const uniqueFlagged = [...new Set(flaggedWords)];

    return {
        hasProfanity: uniqueFlagged.length > 0,
        flaggedWords: uniqueFlagged,
        normalizedText: normalizedText
    };
}

/**
 * Censor profanity in text (replace with asterisks)
 * @param {string} text - Text to censor
 * @returns {string} - Censored text
 */
function censorProfanity(text) {
    if (!text || typeof text !== 'string') return text;

    let censored = text;

    for (const word of PROFANITY_LIST) {
        // Create case-insensitive regex that matches the word
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        censored = censored.replace(regex, (match) => {
            // Keep first letter and replace rest with asterisks
            return match[0] + '*'.repeat(match.length - 1);
        });
    }

    return censored;
}

/**
 * Get a user-friendly warning message for profanity
 * @param {string[]} flaggedWords - Array of detected profane words
 * @returns {string} - Warning message
 */
function getProfanityWarningMessage(flaggedWords) {
    if (!flaggedWords || flaggedWords.length === 0) {
        return '';
    }

    return 'Your comment contains language that may violate our community guidelines. Please revise your comment before submitting.';
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================
window.checkProfanity = checkProfanity;
window.normalizeLeetSpeak = normalizeLeetSpeak;
window.censorProfanity = censorProfanity;
window.getProfanityWarningMessage = getProfanityWarningMessage;

console.log('EventHive Profanity Filter loaded');
