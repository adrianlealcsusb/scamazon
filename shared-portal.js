/**
 * Scamazon Shared Dashboard & Portal Utilities
 * Used across owner.html, storefront.html, and worker.html
 */

export function toggleDarkMode() {
    try {
        const htmlElement = document.documentElement;
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark');
            localStorage.setItem('scamazon_theme', 'light');
        } else {
            htmlElement.classList.add('dark');
            localStorage.setItem('scamazon_theme', 'dark');
        }
    } catch (toggleErr) {
        console.error('Dark mode toggle failed:', toggleErr);
    }
}
window.toggleDarkMode = toggleDarkMode;

export function sanitizeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.sanitizeHtml = sanitizeHtml;

let portalToastTimer = null;

export function showToast(message, type = 'info') {
    let toast = document.getElementById('portal-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'portal-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-12 opacity-0 pointer-events-none transition-all duration-300 ease-out flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border';
        document.body.appendChild(toast);
    }

    const isError = type === 'error';
    const isSuccess = type === 'success';

    const borderClass = isError ? 'border-rose-500/80' : (isSuccess ? 'border-emerald-500/80' : 'border-slate-700/80');
    const badgeBg = isError ? 'bg-rose-500/20 text-rose-400' : (isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400');
    const iconSvg = isError 
        ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>'
        : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';

    toast.className = `fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 pointer-events-auto transition-all duration-300 ease-out flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border ${borderClass}`;
    toast.innerHTML = `
        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${badgeBg}">
            ${iconSvg}
        </div>
        <p class="text-xs font-semibold text-slate-100 max-w-sm leading-snug">${sanitizeHtml(message)}</p>
    `;

    clearTimeout(portalToastTimer);
    portalToastTimer = setTimeout(() => {
        toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
        toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }, 3500);
}
window.showToast = showToast;

export function showModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const err = el.querySelector('.bg-red-50'); 
    if (err) err.classList.add('hidden');
    el.classList.remove('hidden');
}
window.showModal = showModal;

export function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
window.hideModal = hideModal;

export function toggleMobileSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    const shouldOpen = open !== undefined ? open : sidebar.classList.contains('-translate-x-full');
    if (shouldOpen) {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}
window.toggleMobileSidebar = toggleMobileSidebar;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-root').forEach((m) => m.classList.add('hidden'));
        toggleMobileSidebar(false);
    }
});

