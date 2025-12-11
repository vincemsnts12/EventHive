/**
 * EventHive Profanity Filter v2.0
 * Enhanced client-side profanity detection with:
 * - Expanded Filipino + English word lists
 * - Leet speak normalization
 * - Phonetic matching
 * - Word boundary detection
 * - Severity levels
 * - False positive prevention
 */

// ============================================================
// LEET SPEAK NORMALIZATION MAP (Enhanced)
// ============================================================
const LEET_MAP = {
    '0': 'o', '()': 'o',
    '1': 'i', '|': 'i', '!': 'i',
    '2': 'z',
    '3': 'e', '€': 'e',
    '4': 'a', '@': 'a', '^': 'a',
    '5': 's', '$': 's',
    '6': 'g', '9': 'g',
    '7': 't', '+': 't',
    '8': 'b',
    '(': 'c', '<': 'c', '{': 'c', '[': 'c', '©': 'c',
    ')': 'd', '>': 'd', '}': 'd', ']': 'd',
    '£': 'l',
    '¥': 'y',
    '®': 'r',
    '™': 'tm',
    'ñ': 'n', 'Ñ': 'n',
    'ph': 'f', 'PH': 'f'
};

// ============================================================
// PHONETIC SUBSTITUTIONS (sounds-like detection)
// ============================================================
const PHONETIC_MAP = {
    'ph': 'f',
    'ck': 'k',
    'kk': 'k',
    'cc': 'k',
    'qu': 'kw',
    'x': 'ks',
    'wh': 'w',
    'ght': 't',
    'ould': 'ud',
    'tion': 'shun',
    'sion': 'shun'
};

// ============================================================
// WHITELIST - Words that contain profanity substrings but are OK
// (Scunthorpe problem prevention)
// ============================================================
const WHITELIST = [
    'assassin', 'assassination', 'assume', 'assumption', 'asset',
    'bass', 'class', 'classic', 'classical', 'classification',
    'compass', 'encompass', 'harassment', 'mass', 'massage',
    'massive', 'pass', 'passage', 'passenger', 'passion',
    'passionate', 'passive', 'passport', 'password',
    'scunthorpe', 'pussycat', 'pushy', 'cocktail', 'cockpit',
    'peacock', 'hancock', 'cockatoo', 'dickens', 'dickson',
    'cumberland', 'document', 'shitake', 'shiitake',
    'basement', 'casement', 'semen', 'semester',
    'therapist', 'grape', 'drape', 'escape',
    'analysis', 'analyst', 'analyze', 'canal',
    'hello', 'shell', 'shellfish', 'mishell',
    'arsenal', 'snigger', 'niggardly', 'denigrate',
    'butterfingers', 'chigger', 'digger', 'jigger', 'trigger',
    'bigger', 'rigger', 'vigor', 'figure',
    'caulk', 'cocky', 'cockade', 'cocking',
    'shutter', 'shuttle', 'mushroom'
];

// ============================================================
// FILIPINO PROFANITY LIST (Expanded with severity)
// ============================================================
const FILIPINO_PROFANITY = {
    severe: [
        'putangina', 'putang ina', 'puta', 'tangina', 'tang ina',
        'kinginamo', 'kingina', 'pukingina', 'pukinangina',
        'kantot', 'kantutan', 'iyot', 'iyutan', 'kinantot',
        'tite', 'titi', 'burat', 'tamod',
        'puke', 'pepe', 'pekpek', 'kepyas', 'keps',
        'betlog', 'bayag', 'etits', 'junior',
        'jakol', 'jabol', 'salsal', 'finger', 'finjer',
        'pokpok', 'patutot', 'kalapating mababa ang lipad',
        'hindot', 'hindutan', 'iyutan', 'kantotan',
        'libog', 'malibog', 'malandi', 'karat', 'makarat',
        'pota', 'potang ina', 'potangina', 'pucha', 'pakshet'
    ],
    moderate: [
        'gago', 'gaga', 'bobo', 'boba', 'tanga', 'tangahan',
        'ulol', 'inutil', 'tarantado', 'tarantada',
        'kupal', 'gunggong', 'ungas', 'engot', 'hangal',
        'siraulo', 'baliw', 'loko', 'loka',
        'walanghiya', 'walang hiya', 'hayop', 'hayup',
        'hinayupak', 'hudas', 'demonyo', 'satanas',
        'leche', 'lechugas', 'punyeta', 'punyemas',
        'bwisit', 'peste', 'syet', 'shyet', 'chet',
        'pakyu', 'pakyo', 'paksit', 'pakshet',
        'putragis', 'putrages', 'p*ta', 'g*go', 't*nga',
        'olol', 'bobita', 'bobito', 'gagita', 'gagito',
        'animal', 'bruha', 'bruho', 'mokong',
        'kurakot', 'corrupt', 'sinungaling', 'traydor'
    ],
    mild: [
        'kabit', 'pampam', 'plastik', 'plastic',
        'epal', 'kj', 'killjoy', 'feeling', 'feelingera',
        'lutang', 'lutangina', 'praning', 'paranoid',
        'jologs', 'jejemon', 'baduy', 'badoy',
        'tsismosa', 'tsismoso', 'marites',
        'maldita', 'maldito', 'mayabang', 'hambog',
        'suplada', 'suplado', 'snob', 'snobber',
        'abnoy', 'abnormal', 'wierd', 'weird'
    ]
};

// ============================================================
// ENGLISH PROFANITY LIST (Expanded with severity)
// ============================================================
const ENGLISH_PROFANITY = {
    severe: [
        // F-word variations
        'fuck', 'fucker', 'fucking', 'fucked', 'fuckhead', 'fuckface',
        'fck', 'fuk', 'fuc', 'phuck', 'phuk', 'fxck', 'f*ck', 'f**k',
        'motherfucker', 'motherfucking', 'mf', 'mofo',
        // C-word
        'cunt', 'cunts', 'c*nt',
        // Slurs (must block)
        'nigger', 'nigga', 'n1gger', 'n1gga', 'nig', 'n*gger', 'n*gga',
        'negro', 'negra',
        'faggot', 'fag', 'f4g', 'fagg', 'f*ggot', 'f*g',
        'dyke', 'd*ke',
        'retard', 'retarded', 'r3tard', 'r*tard',
        'spic', 'sp*c', 'wetback', 'beaner',
        'chink', 'ch*nk', 'gook',
        'kike', 'k*ke',
        // Sexual explicit
        'cock', 'cocks', 'c0ck', 'c*ck',
        'dick', 'dicks', 'd1ck', 'd*ck', 'dickhead',
        'pussy', 'pussies', 'p*ssy', 'pu$$y',
        'penis', 'vagina', 'dildo', 'vibrator',
        'blowjob', 'blow job', 'handjob', 'hand job',
        'cum', 'cumshot', 'jizz', 'spunk',
        'anal', 'anus', 'butthole', 'asshole', 'a$$hole', 'a**hole',
        'rape', 'raping', 'rapist'
    ],
    moderate: [
        // S-word variations
        'shit', 'shitty', 'bullshit', 'horseshit', 'dipshit', 'shithead',
        'sht', 'sh1t', 'sh*t', 's**t',
        // B-word variations
        'bitch', 'bitchy', 'biatch', 'b1tch', 'b*tch', 'btch',
        'son of a bitch', 'sob',
        // A-word variations
        'ass', 'asses', 'a$$', '@ss', 'a**',
        'dumbass', 'jackass', 'fatass', 'smartass', 'asshat',
        // Bastard variations
        'bastard', 'bastards', 'bstard', 'b*stard',
        // Other moderate
        'whore', 'wh0re', 'wh*re', 'hoe', 'h0e',
        'slut', 'sl*t', 'slutty',
        'skank', 'thot',
        'twat', 'tw*t',
        'piss', 'pissed', 'pissing', 'p*ss',
        'crap', 'crappy', 'cr*p',
        'damn', 'goddamn', 'dammit', 'd*mn', 'goddammit'
    ],
    mild: [
        'hell', 'heck', 'darn', 'dang', 'frick', 'freaking',
        'idiot', 'idiotic', '1diot',
        'stupid', 'stupidity', 'stup1d',
        'moron', 'moronic',
        'dumb', 'dummy', 'dumbo',
        'loser', 'l0ser',
        'jerk', 'jerks',
        'suck', 'sucks', 'sucker', 'sucking',
        'screw', 'screwed', 'screwing',
        'douche', 'douchebag', 'd-bag',
        'prick', 'pr1ck',
        'wanker', 'w*nker',
        'bollocks', 'bloody',
        'bugger', 'buggered'
    ]
};

// Build combined lists for quick lookup
const SEVERE_WORDS = [...FILIPINO_PROFANITY.severe, ...ENGLISH_PROFANITY.severe];
const MODERATE_WORDS = [...FILIPINO_PROFANITY.moderate, ...ENGLISH_PROFANITY.moderate];
const MILD_WORDS = [...FILIPINO_PROFANITY.mild, ...ENGLISH_PROFANITY.mild];
const ALL_PROFANITY = [...SEVERE_WORDS, ...MODERATE_WORDS, ...MILD_WORDS];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize text by converting leet speak and phonetic substitutions
 * @param {string} text - Input text
 * @returns {string} - Normalized text
 */
function normalizeLeetSpeak(text) {
    if (!text) return '';

    let normalized = text.toLowerCase();

    // Replace leet characters
    for (const [leet, letter] of Object.entries(LEET_MAP)) {
        const escaped = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        normalized = normalized.replace(new RegExp(escaped, 'g'), letter);
    }

    // Apply phonetic substitutions
    for (const [sound, replacement] of Object.entries(PHONETIC_MAP)) {
        normalized = normalized.replace(new RegExp(sound, 'g'), replacement);
    }

    // Remove repeated characters (e.g., "fuuuuck" -> "fuck")
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // Remove common separators used to bypass filters
    normalized = normalized.replace(/[\s\-_\.\/\\*]+/g, '');

    return normalized;
}

/**
 * Check if a word is in the whitelist
 * @param {string} text - Text to check
 * @returns {boolean} - True if whitelisted
 */
function isWhitelisted(text) {
    const normalized = text.toLowerCase().replace(/[\s\-_\.\/\\*]+/g, '');
    return WHITELIST.some(word => normalized === word || text.toLowerCase() === word);
}

/**
 * Get severity level of a profane word
 * @param {string} word - Word to check
 * @returns {'severe'|'moderate'|'mild'|null}
 */
function getSeverity(word) {
    const normalizedWord = normalizeLeetSpeak(word);

    for (const severeWord of SEVERE_WORDS) {
        if (normalizeLeetSpeak(severeWord) === normalizedWord ||
            normalizedWord.includes(normalizeLeetSpeak(severeWord))) {
            return 'severe';
        }
    }

    for (const moderateWord of MODERATE_WORDS) {
        if (normalizeLeetSpeak(moderateWord) === normalizedWord ||
            normalizedWord.includes(normalizeLeetSpeak(moderateWord))) {
            return 'moderate';
        }
    }

    for (const mildWord of MILD_WORDS) {
        if (normalizeLeetSpeak(mildWord) === normalizedWord ||
            normalizedWord.includes(normalizeLeetSpeak(mildWord))) {
            return 'mild';
        }
    }

    return null;
}

/**
 * Check if text contains profanity with severity levels
 * @param {string} text - Text to check
 * @returns {{hasProfanity: boolean, severity: string|null, flaggedWords: string[], normalizedText: string}}
 */
function checkProfanity(text) {
    if (!text || typeof text !== 'string') {
        return { hasProfanity: false, severity: null, flaggedWords: [], normalizedText: '' };
    }

    // Check whitelist first - if entire text is whitelisted, skip
    if (isWhitelisted(text)) {
        return { hasProfanity: false, severity: null, flaggedWords: [], normalizedText: text.toLowerCase() };
    }

    const normalizedText = normalizeLeetSpeak(text);
    const flaggedWords = [];
    let highestSeverity = null;
    const severityRank = { 'severe': 3, 'moderate': 2, 'mild': 1 };

    // Check each word in the text
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
        // Skip if word is whitelisted
        if (isWhitelisted(word)) continue;

        const normalizedWord = normalizeLeetSpeak(word);

        for (const profaneWord of ALL_PROFANITY) {
            const normalizedProfane = normalizeLeetSpeak(profaneWord);

            // Check if word matches or contains profanity
            if (normalizedWord === normalizedProfane || normalizedWord.includes(normalizedProfane)) {
                // Verify it's not a false positive by checking context
                if (!isWhitelisted(word)) {
                    flaggedWords.push(profaneWord);

                    const severity = getSeverity(profaneWord);
                    if (severity && (!highestSeverity || severityRank[severity] > severityRank[highestSeverity])) {
                        highestSeverity = severity;
                    }
                }
            }
        }
    }

    // Also check full normalized text for multi-word profanity
    for (const profaneWord of ALL_PROFANITY) {
        if (profaneWord.includes(' ')) {
            const normalizedProfane = normalizeLeetSpeak(profaneWord);
            if (normalizedText.includes(normalizedProfane)) {
                flaggedWords.push(profaneWord);
                const severity = getSeverity(profaneWord);
                if (severity && (!highestSeverity || severityRank[severity] > severityRank[highestSeverity])) {
                    highestSeverity = severity;
                }
            }
        }
    }

    // Remove duplicates
    const uniqueFlagged = [...new Set(flaggedWords)];

    return {
        hasProfanity: uniqueFlagged.length > 0,
        severity: highestSeverity,
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

    // Sort by length (longer first) to catch multi-word phrases
    const sortedProfanity = [...ALL_PROFANITY].sort((a, b) => b.length - a.length);

    for (const word of sortedProfanity) {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        censored = censored.replace(regex, (match) => {
            // Keep first letter and replace rest with asterisks
            return match[0] + '*'.repeat(match.length - 1);
        });
    }

    return censored;
}

/**
 * Get a user-friendly warning message based on severity
 * @param {string} severity - 'severe', 'moderate', or 'mild'
 * @param {string[]} flaggedWords - Array of detected profane words
 * @returns {string} - Warning message
 */
function getProfanityWarningMessage(severity, flaggedWords = []) {
    switch (severity) {
        case 'severe':
            return 'Your message contains highly inappropriate language that violates our community guidelines. This content cannot be posted.';
        case 'moderate':
            return 'Your message contains inappropriate language. Please revise before submitting.';
        case 'mild':
            return 'Your message may contain inappropriate language. Consider revising for a more respectful tone.';
        default:
            return '';
    }
}

/**
 * Determine if content should be blocked based on severity
 * @param {string} severity - Severity level
 * @returns {boolean} - True if content should be blocked
 */
function shouldBlockContent(severity) {
    return severity === 'severe';
}

/**
 * Determine if content should show a warning but allow posting
 * @param {string} severity - Severity level
 * @returns {boolean} - True if warning should be shown
 */
function shouldWarnContent(severity) {
    return severity === 'moderate' || severity === 'mild';
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================
window.checkProfanity = checkProfanity;
window.normalizeLeetSpeak = normalizeLeetSpeak;
window.censorProfanity = censorProfanity;
window.getProfanityWarningMessage = getProfanityWarningMessage;
window.getSeverity = getSeverity;
window.shouldBlockContent = shouldBlockContent;
window.shouldWarnContent = shouldWarnContent;
window.isWhitelisted = isWhitelisted;

console.log('EventHive Profanity Filter v2.0 loaded');
