/**
 * Scamazon Shared Navigation & Session Management
 * Used by marketing and informational pages (plans.html, aboutus.html).
 */

const DESKTOP_LINK_BASE = 'tracking-tight hover:opacity-80 transition-opacity rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';
const DESKTOP_LINK_ACTIVE = 'text-amber-600 dark:text-amber-400 font-semibold';
const DESKTOP_LINK_IDLE = 'text-slate-900 dark:text-slate-300';

const MOBILE_LINK_BASE = 'block w-full rounded-lg px-3 py-2 text-base font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500';
const MOBILE_LINK_ACTIVE = 'text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40';
const MOBILE_LINK_IDLE = 'text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

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

export function readCookie(name) {
    try {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    } catch (cookieErr) {
        console.error('Cookie read failed:', cookieErr);
        return null;
    }
}

export function readSessionCookie() {
    const baseKey = 'sb-wtcqblyyprofjocksdij-auth-token';
    return readCookie(baseKey) || readCookie(`${baseKey}.0`);
}

function desktopNavLink(item, activePage) {
    const active = item.href === activePage;
    const tone = active ? DESKTOP_LINK_ACTIVE : DESKTOP_LINK_IDLE;
    const current = active ? ' aria-current="page"' : '';
    return `<a href="${item.href}" class="${DESKTOP_LINK_BASE} ${tone}"${current}>${item.label}</a>`;
}

function mobileNavLink(item, activePage) {
    const active = item.href === activePage;
    const tone = active ? MOBILE_LINK_ACTIVE : MOBILE_LINK_IDLE;
    const current = active ? ' aria-current="page"' : '';
    return `<a href="${item.href}" class="${MOBILE_LINK_BASE} ${tone}"${current}>${item.label}</a>`;
}

function guestNavItems() {
    return [
        { href: 'index.html', label: 'Home' },
        { href: 'plans.html', label: 'Pricing' },
        { href: 'aboutus.html', label: 'Meet the Team' },
        { href: 'index.html', label: 'Log In' },
    ];
}

function roleNavItems() {
    return [
        { href: 'index.html', label: 'Home' },
        { href: 'plans.html', label: 'Pricing' },
        { href: 'aboutus.html', label: 'Meet the Team' },
    ];
}

export function initResponsiveNav() {
    try {
        const toggle = document.getElementById('nav-toggle');
        const menu = document.getElementById('mobile-menu');
        if (!toggle || !menu) return;

        const iconOpen = document.getElementById('nav-toggle-open');
        const iconClose = document.getElementById('nav-toggle-close');
        const desktopQuery = window.matchMedia('(min-width: 640px)');

        const hiddenMenuClasses = ['max-h-0', 'opacity-0', 'pointer-events-none'];
        const shownMenuClasses = ['max-h-[480px]', 'opacity-100'];

        function setExpanded(expanded) {
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            toggle.setAttribute('aria-label', expanded ? 'Close main menu' : 'Open main menu');
            if (iconOpen) iconOpen.classList.toggle('hidden', expanded);
            if (iconClose) iconClose.classList.toggle('hidden', !expanded);

            hiddenMenuClasses.forEach((className) => menu.classList.toggle(className, !expanded));
            shownMenuClasses.forEach((className) => menu.classList.toggle(className, expanded));

            menu.inert = !expanded;
        }

        function collapseOnDesktop(event) {
            if (event.matches) setExpanded(false);
        }

        toggle.addEventListener('click', function () {
            setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
        });

        menu.addEventListener('click', function (event) {
            if (event.target.closest('a')) setExpanded(false);
        });

        document.addEventListener('click', function (event) {
            if (toggle.getAttribute('aria-expanded') !== 'true') return;
            if (menu.contains(event.target) || toggle.contains(event.target)) return;
            setExpanded(false);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            if (toggle.getAttribute('aria-expanded') !== 'true') return;
            setExpanded(false);
            toggle.focus();
        });

        if (typeof desktopQuery.addEventListener === 'function') {
            desktopQuery.addEventListener('change', collapseOnDesktop);
        } else if (typeof desktopQuery.addListener === 'function') {
            desktopQuery.addListener(collapseOnDesktop);
        }

        setExpanded(false);
    } catch (navError) {
        console.error('Responsive navigation failed to start:', navError);
    }
}

export function renderGuestNav(navbar, activePage) {
    const mobileList = document.getElementById('mobile-menu-list');
    const items = guestNavItems();

    if (navbar) {
        navbar.innerHTML = items.map((item) => desktopNavLink(item, activePage)).join('') + `
            <a href="index.html" class="hidden sm:inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-amber-400 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200">
                Sign Up
            </a>
        `;
    }

    if (mobileList) {
        mobileList.innerHTML = items.map((item) => mobileNavLink(item, activePage)).join('') + `
            <a href="index.html" class="mt-2 flex w-full items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-amber-400 shadow-sm transition-all duration-200">
                Sign Up
            </a>
        `;
    }
}

export function renderRoleNav(navbar, role, activePage) {
    const dashboardMap = {
        owner: 'owner.html',
        customer: 'index.html',
        worker: 'worker.html'
    };
    const dashPage = dashboardMap[role] || 'storefront.html';
    const mobileList = document.getElementById('mobile-menu-list');
    const items = roleNavItems();

    // Clean role badge without pseudo-mono costume
    const roleBadge = `
        <div class="hidden sm:flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
            <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span class="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">${role}</span>
        </div>
    `;

    const desktopDashboard = `
        <a href="${dashPage}" class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-amber-400 shadow-sm transition-all">
            Dashboard
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </a>
    `;

    const desktopLogout = `
        <button type="button" data-logout class="inline-flex items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Sign Out" aria-label="Sign Out">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
    `;

    const mobileRoleBadge = `
        <div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full w-fit mb-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span class="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">${role}</span>
        </div>
    `;

    const mobileDashboard = `
        <a href="${dashPage}" class="mt-2 flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 dark:hover:bg-amber-400 shadow-sm transition-all">
            Dashboard
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </a>
    `;

    const mobileLogout = `
        <button type="button" data-logout class="mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
            Sign Out
        </button>
    `;

    if (navbar) {
        navbar.innerHTML = roleBadge + items.map((item) => desktopNavLink(item, activePage)).join('') + desktopDashboard + desktopLogout;
    }

    if (mobileList) {
        mobileList.innerHTML = mobileRoleBadge + items.map((item) => mobileNavLink(item, activePage)).join('') + mobileDashboard + mobileLogout;
    }
}

export async function setupNav(activePage) {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    // Fast cookie render for initial paint
    const sessionCookie = readSessionCookie();
    const cachedRole = localStorage.getItem('scamazon_user_role');

    if (sessionCookie && cachedRole) {
        renderRoleNav(navbar, cachedRole, activePage);
    } else if (sessionCookie) {
        renderRoleNav(navbar, 'customer', activePage);
    } else {
        renderGuestNav(navbar, activePage);
    }

    // Dynamic Supabase session validation
    try {
        const { client } = await import('./supaBase.js');
        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session) {
            localStorage.removeItem('scamazon_user_role');
            renderGuestNav(navbar, activePage);
            return;
        }

        const email = session.user.email;
        const { data: userRecord } = await client
            .from('users')
            .select('role')
            .eq('email', email)
            .maybeSingle();

        const role = userRecord ? userRecord.role : 'customer';
        localStorage.setItem('scamazon_user_role', role);
        renderRoleNav(navbar, role, activePage);
    } catch (authErr) {
        console.warn('Navigation auth validation fallback:', authErr);
    }

    initResponsiveNav();
}

// Global click listener for sign out
document.addEventListener('click', async (event) => {
    const logout = event.target.closest('[data-logout]');
    if (!logout) return;

    try {
        logout.disabled = true;
        const { client } = await import('./supaBase.js');
        localStorage.removeItem('scamazon_user_role');
        await client.auth.signOut();
        window.location.reload();
    } catch (err) {
        console.error('Logout failed:', err);
        logout.disabled = false;
    }
});

