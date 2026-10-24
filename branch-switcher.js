/**
 * Scamazon Multi-Branch Switcher Widget
 * Seamlessly switch between 'main' (current build) and 'Prototype-1' (prototype build).
 */
(function() {
    // Avoid double injection
    if (document.getElementById('scamazon-branch-switcher')) return;

    function initBranchSwitcher() {
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
            // Target is Main build
            if (['owner.html', 'storefront.html', 'worker.html'].includes(currentFile)) {
                targetUrl = '/' + currentFile;
            } else if (currentFile === 'customer.html' || currentFile === 'login.html') {
                targetUrl = '/index.html';
            } else {
                targetUrl = '/';
            }
        } else {
            // Target is Prototype-1 build
            if (['owner.html', 'storefront.html', 'worker.html'].includes(currentFile)) {
                targetUrl = '/prototype-1/' + currentFile;
            } else {
                targetUrl = '/prototype-1/';
            }
        }

        const isCollapsed = sessionStorage.getItem('scamazon_branch_switcher_min') === 'true';

        const container = document.createElement('div');
        container.id = 'scamazon-branch-switcher';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
            font-size: 13px;
            user-select: none;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const activeBranchName = isProto ? 'Prototype-1' : 'main';
        const activeBadgeColor = isProto ? '#f59e0b' : '#3b82f6';
        const targetBranchName = isProto ? 'Main Build' : 'Prototype-1';
        const targetDescription = isProto 
            ? 'Switch to current production build (Courier Deliveries)' 
            : 'Switch to Prototype 1 build (In-Store Pickups)';

        container.innerHTML = `
            <!-- Expanded Pill -->
            <div id="branch-switcher-pill" style="
                display: ${isCollapsed ? 'none' : 'flex'};
                align-items: center;
                gap: 10px;
                padding: 6px 8px 6px 14px;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 9999px;
                box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.4), 0 4px 12px -2px rgba(0, 0, 0, 0.3);
                color: #f8fafc;
            ">
                <!-- Branch Icon & Current Branch Indicator -->
                <div style="display: flex; align-items: center; gap: 7px; cursor: default;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${activeBadgeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15"></line>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                    <span style="font-weight: 500; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Branch:</span>
                    <span style="font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 5px;">
                        ${activeBranchName}
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${activeBadgeColor}; box-shadow: 0 0 8px ${activeBadgeColor};"></span>
                    </span>
                </div>

                <div style="width: 1px; height: 16px; background: rgba(255, 255, 255, 0.15);"></div>

                <!-- Switch Action Button -->
                <a href="${targetUrl}" title="${targetDescription}" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 12px;
                    background: ${isProto ? '#f59e0b' : '#3b82f6'};
                    color: ${isProto ? '#0f172a' : '#ffffff'};
                    border-radius: 9999px;
                    font-size: 12px;
                    font-weight: 700;
                    text-decoration: none;
                    transition: transform 0.15s ease, filter 0.15s ease;
                    white-space: nowrap;
                " onmouseover="this.style.transform='translateY(-1px)'; this.style.filter='brightness(1.1)';" onmouseout="this.style.transform='none'; this.style.filter='none';">
                    <span>${targetBranchName}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </a>

                <!-- Minimize Button -->
                <button id="branch-switcher-close" title="Minimize switcher" style="
                    background: transparent;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.15s ease;
                " onmouseover="this.style.color='#cbd5e1';" onmouseout="this.style.color='#64748b';">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <!-- Minimized Trigger Icon -->
            <button id="branch-switcher-minimized" title="Open Branch Switcher (Current: ${activeBranchName})" style="
                display: ${isCollapsed ? 'flex' : 'none'};
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.15s ease;
            " onmouseover="this.style.transform='scale(1.08)';" onmouseout="this.style.transform='none';">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${activeBadgeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
            pill.style.display = 'none';
            minBtn.style.display = 'flex';
            sessionStorage.setItem('scamazon_branch_switcher_min', 'true');
        });

        minBtn.addEventListener('click', () => {
            minBtn.style.display = 'none';
            pill.style.display = 'flex';
            sessionStorage.setItem('scamazon_branch_switcher_min', 'false');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBranchSwitcher);
    } else {
        initBranchSwitcher();
    }
})();

