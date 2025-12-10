// ===== PROFILE PAGE AUTH GUARD =====
// Handles authentication for profile pages
// - Own profile (no ?uid param): Requires auth, redirects guests to homepage
// - Other's profile (?uid=xxx param): Requires auth, shows login popup for guests
// Must be loaded early in the script order

(function () {
    'use strict';

    // Get uid from URL parameter (if any)
    function getUrlUserId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('uid');
    }

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

    // Show login popup (for viewing other's profile as guest)
    function showLoginPopup() {
        function tryShowPopup() {
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'flex';

                // Store the pending profile URL for redirect after login
                sessionStorage.setItem('eventhive_pending_profile_url', window.location.href);

                console.log('Profile auth guard: Showing login popup for guest');
                return true;
            }
            return false;
        }

        // Try immediately
        if (!tryShowPopup()) {
            // Wait for DOMContentLoaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', tryShowPopup);
            } else {
                setTimeout(tryShowPopup, 100);
                setTimeout(tryShowPopup, 500);
            }
        }
    }

    // Monitor login modal close (guest didn't login)
    function monitorModalClose() {
        document.addEventListener('DOMContentLoaded', function () {
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                // Create observer to detect when modal is hidden
                const observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const display = loginModal.style.display;
                            if (display === 'none' || display === '') {
                                // Modal was closed - check if we're still not logged in
                                const pendingUrl = sessionStorage.getItem('eventhive_pending_profile_url');
                                if (pendingUrl && !checkAuthStatus()) {
                                    // User closed popup without logging in
                                    sessionStorage.removeItem('eventhive_pending_profile_url');
                                    alert('Please log in to view profiles.');
                                    window.location.replace(window.location.origin + '/eventhive-homepage.html');
                                }
                            }
                        }
                    });
                });

                observer.observe(loginModal, { attributes: true, attributeFilter: ['style'] });
            }
        });
    }

    // Execute check
    const urlUserId = getUrlUserId();
    const isAuthenticated = checkAuthStatus();
    const isViewingOthersProfile = urlUserId && urlUserId.length > 0;

    // Check if viewing own profile via uid - check multiple sources for current user ID
    let currentUserId = localStorage.getItem('eventhive_last_authenticated_user_id');

    // If not found, try to get from Supabase auth token
    if (!currentUserId) {
        try {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.startsWith('sb-') && key.includes('auth-token')) {
                    const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
                    if (tokenData.access_token) {
                        // Decode JWT to get user ID
                        const payload = JSON.parse(atob(tokenData.access_token.split('.')[1]));
                        currentUserId = payload.sub;
                        break;
                    }
                    if (tokenData.user && tokenData.user.id) {
                        currentUserId = tokenData.user.id;
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn('Error getting current user ID from auth token:', e);
        }
    }

    console.log('Profile auth guard: URL user ID:', urlUserId);
    console.log('Profile auth guard: Current user ID:', currentUserId);

    const isViewingOwnProfileViaUid = isViewingOthersProfile && urlUserId === currentUserId;

    console.log('Profile auth guard: Is viewing own profile via uid:', isViewingOwnProfileViaUid);

    // Expose for profile-load.js
    // If viewing own profile (either no uid, or uid matches current user), set viewing other to false
    window.__EH_VIEWING_OTHER_PROFILE = isViewingOthersProfile && !isViewingOwnProfileViaUid;
    window.__EH_VIEW_USER_ID = isViewingOwnProfileViaUid ? null : urlUserId; // Clear uid if it's own profile

    console.log('Profile auth guard: __EH_VIEWING_OTHER_PROFILE:', window.__EH_VIEWING_OTHER_PROFILE);

    if (!isAuthenticated) {
        if (isViewingOthersProfile) {
            // Guest trying to view someone else's profile - show login popup
            console.log('Profile auth guard: Guest viewing other profile - showing login popup');
            showLoginPopup();
            monitorModalClose();

            // Mark that we need auth but don't block page load
            window.__EH_PROFILE_AUTH_REQUIRED = true;
        } else {
            // Guest trying to view own profile - redirect to homepage
            console.log('Profile auth guard: Guest viewing own profile - redirecting');
            redirectToHomepage();
            throw new Error('Profile access denied - not authenticated');
        }
    } else {
        console.log('Profile auth guard: User authenticated');
        window.__EH_PROFILE_AUTH_REQUIRED = false;

        // Clear any pending profile URL
        sessionStorage.removeItem('eventhive_pending_profile_url');
    }

    // Check for pending profile redirect after successful login
    document.addEventListener('DOMContentLoaded', function () {
        const pendingUrl = sessionStorage.getItem('eventhive_pending_profile_url');
        if (pendingUrl && checkAuthStatus()) {
            // User logged in - clear and stay on page (already at the right URL)
            sessionStorage.removeItem('eventhive_pending_profile_url');
        }
    });
})();
