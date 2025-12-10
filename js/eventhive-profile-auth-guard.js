// ===== PROFILE PAGE AUTH GUARD =====
// Ensures only authenticated users can access profile pages
// Redirects guests to homepage with login prompt
// Must be loaded early in the script order

(function () {
    'use strict';

    // Check auth status from localStorage (synchronous, fast)
    function checkAuthStatus() {
        // Method 1: Check eventhive_auth_cache
        try {
            const authCache = JSON.parse(localStorage.getItem('eventhive_auth_cache') || '{}');
            if (authCache.state && authCache.state.isLoggedIn === true) {
                return true;
            }
        } catch (e) {
            // Ignore parse errors
        }

        // Method 2: Check for Supabase auth token
        try {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.startsWith('sb-') && key.includes('auth-token')) {
                    const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
                    if (tokenData.access_token) {
                        return true;
                    }
                }
            }
        } catch (e) {
            // Ignore errors
        }

        // Method 3: Check eventhive_last_authenticated_user_id
        const userId = localStorage.getItem('eventhive_last_authenticated_user_id');
        if (userId && userId.length > 0) {
            return true;
        }

        return false;
    }

    // Redirect to homepage with message
    function redirectToHomepage() {
        alert('Please log in to view your profile.');
        const homepage = window.location.origin + '/eventhive-homepage.html';
        window.location.replace(homepage);
    }

    // Execute check immediately
    const isAuthenticated = checkAuthStatus();

    if (!isAuthenticated) {
        console.log('Profile auth guard: User not authenticated - redirecting to homepage');
        redirectToHomepage();

        // Stop script execution
        throw new Error('Profile access denied - not authenticated');
    }

    console.log('Profile auth guard: User authenticated');

    // Also verify with async Supabase check after page loads (belt and suspenders)
    document.addEventListener('DOMContentLoaded', async function () {
        // Double-check with Supabase session
        if (typeof getSupabaseClient === 'function') {
            try {
                const supabase = getSupabaseClient();
                if (supabase) {
                    // Use timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Session check timeout')), 5000)
                    );

                    const sessionPromise = supabase.auth.getSession();
                    const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

                    if (!session || !session.user) {
                        // No valid session - redirect
                        console.warn('Profile auth guard: No valid Supabase session - redirecting');
                        redirectToHomepage();
                    }
                }
            } catch (err) {
                if (err.message !== 'Session check timeout') {
                    console.error('Profile auth guard: Error checking session:', err);
                }
                // On timeout, trust the localStorage check already done
            }
        }
    });
})();
