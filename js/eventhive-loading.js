// ===== EVENTHIVE LOADING SPINNER =====
// Global loading overlay for async operations
// Usage: showLoading() / hideLoading()

(function () {
    'use strict';

    let loadingOverlay = null;
    let loadingCount = 0; // Track nested loading calls

    // Create the loading overlay DOM element
    function createLoadingOverlay() {
        if (loadingOverlay) return loadingOverlay;

        // Create overlay
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'ehLoadingOverlay';
        loadingOverlay.className = 'eh-loading-overlay';

        // Create spinner
        const spinner = document.createElement('div');
        spinner.className = 'eh-loading-spinner';

        loadingOverlay.appendChild(spinner);
        document.body.appendChild(loadingOverlay);

        return loadingOverlay;
    }

    // Show loading overlay
    function showLoading() {
        loadingCount++;

        if (loadingCount === 1) {
            const overlay = createLoadingOverlay();
            overlay.classList.add('active');
            document.body.classList.add('eh-loading');
        }
    }

    // Hide loading overlay
    function hideLoading() {
        loadingCount = Math.max(0, loadingCount - 1);

        if (loadingCount === 0 && loadingOverlay) {
            loadingOverlay.classList.remove('active');
            document.body.classList.remove('eh-loading');
        }
    }

    // Force hide (reset counter)
    function forceHideLoading() {
        loadingCount = 0;
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
            document.body.classList.remove('eh-loading');
        }
    }

    // Check if loading is active
    function isLoading() {
        return loadingCount > 0;
    }

    // Expose globally
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.forceHideLoading = forceHideLoading;
    window.isLoading = isLoading;

    // Auto-hide on page fully loaded (safety net)
    window.addEventListener('load', function () {
        // Give a brief moment for any post-load operations
        setTimeout(function () {
            if (loadingCount > 0) {
                console.warn('Loading spinner was still active after page load, forcing hide');
                forceHideLoading();
            }
        }, 5000);
    });

    console.log('Loading spinner utilities loaded');
})();
