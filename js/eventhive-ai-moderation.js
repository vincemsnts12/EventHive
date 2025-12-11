/**
 * EventHive AI Moderation Service
 * Uses OpenAI Moderation API for advanced content moderation
 * Falls back to local profanity filter if API unavailable
 */

// ============================================================
// CONFIGURATION
// ============================================================

// OpenAI API key - will be set via initAIModeration() from eventhive-supabase.js
let _aiModerationApiKey = null;

// Cache for moderation results (reduces API calls)
const moderationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
let lastApiCall = 0;
const MIN_API_INTERVAL = 100; // 100ms between calls

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize AI moderation with API key
 * @param {string} apiKey - OpenAI API key
 */
function initAIModeration(apiKey) {
    if (apiKey && apiKey.startsWith('sk-')) {
        _aiModerationApiKey = apiKey;
        console.log('AI Moderation initialized with OpenAI API');
        return true;
    }
    console.warn('AI Moderation: Invalid or missing API key, using local filter only');
    return false;
}

// ============================================================
// OPENAI MODERATION API
// ============================================================

/**
 * Call OpenAI Moderation API
 * @param {string} text - Text to check
 * @returns {Promise<{flagged: boolean, categories: Object, scores: Object}>}
 */
async function callOpenAIModeration(text) {
    if (!_aiModerationApiKey) {
        throw new Error('OpenAI API key not configured');
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastApiCall < MIN_API_INTERVAL) {
        await new Promise(r => setTimeout(r, MIN_API_INTERVAL - (now - lastApiCall)));
    }
    lastApiCall = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${_aiModerationApiKey}`
            },
            body: JSON.stringify({
                input: text,
                model: 'text-moderation-latest'
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const result = data.results?.[0];

        if (!result) {
            throw new Error('Invalid API response');
        }

        return {
            flagged: result.flagged,
            categories: result.categories,
            scores: result.category_scores
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('API request timed out');
        }
        throw error;
    }
}

// ============================================================
// COMBINED MODERATION (AI + Local)
// ============================================================

/**
 * Map OpenAI categories to severity levels
 */
const CATEGORY_SEVERITY = {
    // Severe (block immediately)
    'sexual/minors': 'severe',
    'hate/threatening': 'severe',
    'violence/graphic': 'severe',
    'self-harm/intent': 'severe',
    'self-harm/instructions': 'severe',

    // Moderate (warn user)
    'hate': 'moderate',
    'harassment/threatening': 'moderate',
    'violence': 'moderate',
    'self-harm': 'moderate',

    // Mild (allow with warning)
    'harassment': 'mild',
    'sexual': 'mild'
};

/**
 * Get severity from OpenAI categories
 * @param {Object} categories - OpenAI flagged categories
 * @returns {'severe'|'moderate'|'mild'|null}
 */
function getSeverityFromCategories(categories) {
    if (!categories) return null;

    // Check for most severe first
    for (const [category, severity] of Object.entries(CATEGORY_SEVERITY)) {
        if (categories[category]) {
            return severity;
        }
    }

    return null;
}

/**
 * Comprehensive content moderation combining AI and local filter
 * @param {string} text - Text to moderate
 * @param {Object} options - Options
 * @param {boolean} options.useAI - Whether to use AI moderation (default: true)
 * @param {boolean} options.useCache - Whether to use cached results (default: true)
 * @returns {Promise<{
 *   flagged: boolean,
 *   blocked: boolean,
 *   severity: string|null,
 *   message: string,
 *   source: 'ai'|'local'|'both',
 *   categories?: Object,
 *   flaggedWords?: string[]
 * }>}
 */
async function moderateContent(text, options = {}) {
    const { useAI = true, useCache = true } = options;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
            flagged: false,
            blocked: false,
            severity: null,
            message: '',
            source: 'local'
        };
    }

    const cacheKey = text.substring(0, 500); // Limit cache key length

    // Check cache first
    if (useCache && moderationCache.has(cacheKey)) {
        const cached = moderationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return { ...cached.result, cached: true };
        }
        moderationCache.delete(cacheKey);
    }

    // Run local profanity check
    const localResult = window.checkProfanity ? window.checkProfanity(text) : { hasProfanity: false };

    let result = {
        flagged: localResult.hasProfanity,
        blocked: localResult.severity === 'severe',
        severity: localResult.severity,
        message: '',
        source: 'local',
        flaggedWords: localResult.flaggedWords || []
    };

    // If AI is enabled and key is available, also check with OpenAI
    if (useAI && _aiModerationApiKey) {
        try {
            const aiResult = await callOpenAIModeration(text);

            if (aiResult.flagged) {
                const aiSeverity = getSeverityFromCategories(aiResult.categories);

                // Combine results - use the more severe finding
                const severityRank = { 'severe': 3, 'moderate': 2, 'mild': 1 };

                if (!result.severity ||
                    (aiSeverity && severityRank[aiSeverity] > severityRank[result.severity])) {
                    result.severity = aiSeverity;
                }

                result.flagged = true;
                result.blocked = result.severity === 'severe';
                result.categories = aiResult.categories;
                result.source = result.flaggedWords?.length ? 'both' : 'ai';
            }
        } catch (error) {
            console.warn('AI moderation failed, using local filter only:', error.message);
            // Continue with local result only
        }
    }

    // Set appropriate message
    if (result.flagged) {
        result.message = window.getProfanityWarningMessage
            ? window.getProfanityWarningMessage(result.severity, result.flaggedWords)
            : 'Content may violate community guidelines.';
    }

    // Cache the result
    if (useCache) {
        moderationCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
    }

    return result;
}

/**
 * Quick check for content (local only, no async)
 * Use for real-time validation while typing
 * @param {string} text - Text to check
 * @returns {{flagged: boolean, severity: string|null, blocked: boolean}}
 */
function quickCheck(text) {
    if (!text || typeof text !== 'string') {
        return { flagged: false, severity: null, blocked: false };
    }

    const result = window.checkProfanity ? window.checkProfanity(text) : { hasProfanity: false };

    return {
        flagged: result.hasProfanity,
        severity: result.severity,
        blocked: result.severity === 'severe'
    };
}

/**
 * Clear moderation cache
 */
function clearModerationCache() {
    moderationCache.clear();
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================
window.initAIModeration = initAIModeration;
window.moderateContent = moderateContent;
window.quickCheck = quickCheck;
window.clearModerationCache = clearModerationCache;

console.log('EventHive AI Moderation Service loaded');
