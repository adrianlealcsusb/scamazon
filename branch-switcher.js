/**
 * Scamazon Multi-Branch Switcher Widget
 * Developer-grade floating dock to switch between 'main' (Production) and 'Prototype-1' (Prototype).
 */
(function() {
    // Avoid double injection
    if (document.getElementById('scamazon-branch-switcher')) return;

    function injectStyles() {
        if (document.getElementById('scamazon-branch-switcher-styles')) return;
        const style = document.createElement('style');
        style.id = 'scamazon-branch-switcher-styles';
        style.textContent = `
            #scamazon-branch-switcher {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
                font-size: 13px;
                user-select: none;
                line-height: 1.4;
            }

            .scamazon-switcher-pill {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 6px 8px 6px 12px;
                background: rgba(15, 23, 42, 0.96);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 9999px;
                box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.3), 0 2px 6px -1px rgba(0, 0, 0, 0.2);
                color: #f8fafc;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }

            .scamazon-switcher-pill.is-hidden {
                display: none;
            }

            .scamazon-switcher-meta {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: #cbd5e1;
            }

            .scamazon-switcher-branch-name {
                font-weight: 700;
                color: #f8fafc;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .scamazon-switcher-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #f59e0b;
                display: inline-block;
            }

            .scamazon-switcher-divider {
                width: 1px;
                height: 14px;
                background: rgba(255, 255, 255, 0.15);
            }

            .scamazon-switcher-action {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 4px 11px;
                background: #f59e0b;
                color: #0f172a;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 700;
                text-decoration: none;
                transition: background-color 0.15s ease, transform 0.15s ease;
                white-space: nowrap;
            }

            .scamazon-switcher-action:hover {
                background: #fbbf24;
                transform: translateY(-0.5px);
            }

            .scamazon-switcher-action:active {
                transform: translateY(0);
            }

            .scamazon-switcher-action:focus-visible {
                outline: 2px solid #f59e0b;
                outline-offset: 2px;
            }

            .scamazon-switcher-close {
                background: transparent;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.15s ease, background-color 0.15s ease;
            }

            .scamazon-switcher-close:hover {
                color: #f1f5f9;
                background: rgba(255, 255, 255, 0.08);
            }

            .scamazon-switcher-close:focus-visible {
                outline: 2px solid #f59e0b;
                outline-offset: 1px;
            }

            .scamazon-switcher-min {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(15, 23, 42, 0.96);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.14);
                box-shadow: 0 4px 14px -2px rgba(0, 0, 0, 0.3);
                cursor: pointer;
                color: #f59e0b;
                transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
            }

            .scamazon-switcher-min:hover {
                transform: scale(1.06);
                background: rgba(30, 41, 59, 0.98);
                border-color: rgba(245, 158, 11, 0.4);
            }

            .scamazon-switcher-min:active {
                transform: scale(0.96);
            }

            .scamazon-switcher-min:focus-visible {
                outline: 2px solid #f59e0b;
                outline-offset: 2px;
            }

            .scamazon-switcher-min.is-hidden {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    function initBranchSwitcher() {
        injectStyles();

        const path = window.location.pathname;
        const host = window.location.hostname;
        const isProto = path.startsWith('/prototype-1') || host.startsWith('prototype1.');

        // Extract current base file
        let currentFile = path.split('/').filter(Boolean).pop() || 'index.html';
        if (!currentFile.includes('.')) {
            currentFile += '.html';
        }

        // Compute counterpart destination
        let targetUrl = '';
        if (isProto) {
            // Target is Prototype-2 build (/prototype-2/)
            if (['owner.html', 'storefront.html', 'worker.html'].includes(currentFile)) {
                targetUrl = '/prototype-2/' + currentFile;
            } else if (currentFile === 'customer.html' || currentFile === 'login.html') {
                targetUrl = '/prototype-2/index.html';
            } else {
                targetUrl = '/prototype-2/';
            }
        } else {
            // Target is Prototype-1 build (/prototype-1/)
            if (['owner.html', 'storefront.html', 'worker.html'].includes(currentFile)) {
                targetUrl = '/prototype-1/' + currentFile;
            } else {
                targetUrl = '/prototype-1/';
            }
        }

        // Default to minimized at first; only expand if user explicitly toggled it open in this session
        const isCollapsed = sessionStorage.getItem('scamazon_branch_switcher_min') !== 'false';

        const activeBranchName = isProto ? 'Prototype-1' : 'prototype-2';
        const targetBranchName = isProto ? 'prototype-2' : 'Prototype-1';
        const targetDescription = isProto 
            ? 'Switch to prototype-2 build (Courier Deliveries)' 
            : 'Switch to Prototype 1 build (In-Store Pickups)';

        const container = document.createElement('div');
        container.id = 'scamazon-branch-switcher';

        container.innerHTML = `
            <!-- Expanded Pill -->
            <div id="branch-switcher-pill" class="scamazon-switcher-pill ${isCollapsed ? 'is-hidden' : ''}">
                <div class="scamazon-switcher-meta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="6" y1="3" x2="6" y2="15"></line>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                    <span class="scamazon-switcher-branch-name">
                        ${activeBranchName}
                        <span class="scamazon-switcher-dot" title="Active"></span>
                    </span>
                </div>

                <div class="scamazon-switcher-divider" aria-hidden="true"></div>

                <a href="${targetUrl}" class="scamazon-switcher-action" title="${targetDescription}">
                    <span>${targetBranchName}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </a>

                <button id="branch-switcher-close" class="scamazon-switcher-close" title="Minimize switcher" aria-label="Minimize branch switcher">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <!-- Minimized Trigger Icon -->
            <button id="branch-switcher-minimized" class="scamazon-switcher-min ${isCollapsed ? '' : 'is-hidden'}" title="Open Branch Switcher (Current: ${activeBranchName})" aria-label="Open Branch Switcher (Current: ${activeBranchName})">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="6" y1="3" x2="6" y2="15"></line>
                    <circle cx="18" cy="6" r="3"></circle>
                    <circle cx="6" cy="18" r="3"></circle>
                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                </svg>
            </button>
        `;

        document.body.appendChild(container);

        const pill = document.getElementById('branch-switcher-pill');
        const minBtn = document.getElementById('branch-switcher-minimized');
        const closeBtn = document.getElementById('branch-switcher-close');

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pill.classList.add('is-hidden');
            minBtn.classList.remove('is-hidden');
            sessionStorage.setItem('scamazon_branch_switcher_min', 'true');
        });

        minBtn.addEventListener('click', () => {
            minBtn.classList.add('is-hidden');
            pill.classList.remove('is-hidden');
            sessionStorage.setItem('scamazon_branch_switcher_min', 'false');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBranchSwitcher);
    } else {
        initBranchSwitcher();
    }
})();
