/**
 * Scamazon - Shared Utility Functions
 * Sanitization, formatting, and standard modal helpers.
 */

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {*} str - Input string or primitive.
 * @returns {string} Sanitized string.
 */
function sanitizeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Formats a numeric price into a currency string ($0.00).
 * @param {number|string} amount
 * @returns {string} Formatted currency.
 */
function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Displays a modal element and clears any internal alert errors.
 * @param {string} id - Modal container element ID.
 */
function showModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const err = el.querySelector('.bg-red-50');
    if (err) err.classList.add('hidden');
    el.classList.remove('hidden');
}

/**
 * Hides a modal element by ID.
 * @param {string} id - Modal container element ID.
 */
function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

