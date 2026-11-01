/**
 * Scamazon - Shared Utility Functions
 * Sanitization, formatting, standard modal helpers, and unified portal operations.
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
    if (typeof amount === 'string') {
        const clean = amount.replace(/^\$/, '').trim();
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) amount = parsed;
    }
    const num = parseFloat(amount) || 0;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Displays a modal element and clears any internal alert errors.
 * @param {string} id - Modal container element ID.
 */
function showModal(id) {
    injectSharedModals();
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

/**
 * Global Tab Navigation Controller for Dashboards (Owner, Storefront, Worker).
 * @param {string} tab - The tab identifier (e.g. 'listings', 'orders', 'sales').
 */
function switchDashboardTab(tab) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    const targetPane = document.getElementById(`pane-${tab}`);
    if (targetPane) targetPane.classList.remove('hidden');

    document.querySelectorAll('#sidebar-nav .nav-item').forEach(btn => {
        const badge = btn.querySelector('span');
        const isSelected = btn.dataset.tab === tab;
        btn.className = `nav-item w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm font-medium transition-all ${
            isSelected ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
        }`;
        if (badge) {
            badge.className = `text-xs px-2 py-0.5 rounded-md font-mono ${
                isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`;
        }
    });

    const titles = {
        listings: 'Manage Listings',
        storefronts: 'Manage Storefronts',
        workers: 'Manage Workers',
        orders: 'Orders & Fulfillment',
        sales: 'Sales & Analytics'
    };
    const headingEl = document.getElementById('page-heading');
    if (headingEl && titles[tab]) headingEl.textContent = titles[tab];
}
window.switchTab = switchDashboardTab;

/**
 * Shared Delete Confirmation Modal Controller.
 */
let onConfirmDelete = null;

function askDelete(title, msg, fn, confirmText = 'Delete') {
    injectSharedModals();
    const titleEl = document.getElementById('delete-modal-title');
    const msgEl = document.getElementById('delete-modal-message');
    const btn = document.getElementById('delete-modal-confirm-btn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (btn) {
        btn.textContent = confirmText;
        btn.dataset.confirmText = confirmText;
    }

    onConfirmDelete = fn;
    showModal('delete-modal');
}

function initDeleteModalHandler() {
    const confirmBtn = document.getElementById('delete-modal-confirm-btn');
    if (!confirmBtn || confirmBtn.dataset.bound) return;
    confirmBtn.dataset.bound = 'true';

    confirmBtn.addEventListener('click', async () => {
        if (!onConfirmDelete) return;
        const btn = document.getElementById('delete-modal-confirm-btn');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            await onConfirmDelete();
            hideModal('delete-modal');
            onConfirmDelete = null;
        } catch (e) {
            const err = document.getElementById('delete-modal-error');
            if (err) {
                err.textContent = e.message || 'Action failed.';
                err.classList.remove('hidden');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = btn.dataset.confirmText || 'Delete';
        }
    });
}

/**
 * Shared Supabase Order Status Updater with constraint fallback handling.
 * @param {string} orderId
 * @param {string} newStatus
 * @param {Array} stateOrders
 * @param {Function} onComplete
 */
async function updateOrderStatusHelper(orderId, newStatus, stateOrders, onComplete) {
    const order = (stateOrders || []).find(o => o.id === orderId);
    if (!order) return;

    const dbClient = (typeof window !== 'undefined' && window.client) ? window.client : (typeof client !== 'undefined' ? client : null);
    if (!dbClient) {
        console.error('Database client not found');
        return;
    }

    const dbStatus = newStatus === 'Shipped' ? 'Ready for Driver' : newStatus;

    try {
        const { error } = await dbClient
            .from('orders')
            .update({ status: dbStatus })
            .eq('id', orderId);

        if (error) {
            if (error.code === '23514' && newStatus === 'Delivered') {
                const { error: fallbackErr } = await dbClient
                    .from('orders')
                    .update({ status: 'Out for Delivery' })
                    .eq('id', orderId);
                if (fallbackErr) throw fallbackErr;
            } else {
                throw error;
            }
        }

        order.status = (newStatus === 'Shipped') ? 'Ready for Driver' : newStatus;
        if (typeof onComplete === 'function') onComplete();
    } catch (err) {
        console.error('Failed to update order status:', err);
        alert('Could not update order status: ' + (err.message || 'Unknown error'));
        if (typeof onComplete === 'function') onComplete();
    }
}

/**
 * Shared Order Receipt Modal Renderer for Dashboards.
 * @param {string} orderId
 * @param {Array} orders
 * @param {Array} listings
 * @param {string} defaultBranch
 */
function viewOrderReceiptHelper(orderId, orders, listings, defaultBranch) {
    injectSharedModals();
    const order = (orders || []).find(o => o.id === orderId);
    if (!order) return;

    const orderIdEl = document.getElementById('receipt-order-id');
    if (orderIdEl) orderIdEl.textContent = order.order_number || ('Order #' + order.id.slice(0, 6));

    const branchEl = document.getElementById('receipt-branch-name');
    if (branchEl) branchEl.textContent = order.storefront || defaultBranch || 'Central Depot';

    const d = order.created_at ? new Date(order.created_at) : new Date();
    const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const dateTimeEl = document.getElementById('receipt-date-time');
    if (dateTimeEl) dateTimeEl.textContent = `${formattedDate} at ${formattedTime}`;

    const badge = document.getElementById('receipt-status-badge');
    if (badge) {
        const displayStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');
        badge.textContent = displayStatus;
        badge.className = 'inline-block mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border ' + 
            (order.status === 'Shipped' || order.status === 'Ready for Driver' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
             order.status === 'Out for Delivery' ? 'bg-purple-50 text-purple-700 border-purple-200' :
             order.status === 'Delivered' ? 'bg-teal-50 text-teal-700 border-teal-200' :
             order.status === 'Pick' ? 'bg-amber-50 text-amber-700 border-amber-200' :
             'bg-slate-100 text-slate-900 border-slate-200');
    }

    const tbody = document.getElementById('receipt-items-tbody');
    let subtotal = 0;
    let itemRows = '';

    if (order.items && typeof order.items === 'string') {
        const itemsArr = order.items.split(/,\s*(?=\d+\s*x)/i);
        
        itemsArr.forEach(rawItem => {
            const countMatch = rawItem.match(/^(\d+)\s*x\s*(.*)$/i);
            const qty = countMatch ? parseInt(countMatch[1], 10) : 1;
            const titleStr = countMatch ? countMatch[2].trim() : rawItem.trim();

            const matchedListing = (listings || []).find(l => 
                (l.sku && titleStr.toLowerCase().includes(l.sku.toLowerCase())) || 
                (l.title && titleStr.toLowerCase().includes(l.title.toLowerCase()))
            );

            const unitPrice = matchedListing ? parseFloat(matchedListing.price) : 24.99;
            const lineTotal = unitPrice * qty;
            subtotal += lineTotal;

            itemRows += `
                <tr class="hover:bg-slate-50/50">
                    <td class="py-2.5 px-3 text-slate-800 font-sans font-medium">${sanitizeHtml(titleStr)}</td>
                    <td class="py-2.5 px-3 text-center text-slate-600">${qty}</td>
                    <td class="py-2.5 px-3 text-right text-slate-600">${formatCurrency(unitPrice)}</td>
                    <td class="py-2.5 px-3 text-right font-semibold text-slate-900">${formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });
    }

    if (tbody) tbody.innerHTML = itemRows || '<tr><td colspan="4" class="p-3 text-center text-slate-400">No item details recorded.</td></tr>';

    const tax = subtotal * 0.0825;
    const total = subtotal + tax;

    const subtotalEl = document.getElementById('receipt-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

    const taxEl = document.getElementById('receipt-tax');
    if (taxEl) taxEl.textContent = formatCurrency(tax);

    const totalEl = document.getElementById('receipt-total');
    if (totalEl) totalEl.textContent = formatCurrency(total);

    showModal('receipt-modal');
}

/**
 * Injects unified Delete Confirmation & Receipt Modals into the DOM if they are not already present.
 */
function injectSharedModals() {
    if (typeof document === 'undefined' || !document.body) return;

    if (!document.getElementById('delete-modal')) {
        const delDiv = document.createElement('div');
        delDiv.id = 'delete-modal';
        delDiv.className = 'modal-root hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        delDiv.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 id="delete-modal-title" class="text-base font-bold text-slate-900">Delete Item</h2>
                    <button onclick="hideModal('delete-modal')" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                </div>
                <div class="p-6 space-y-4">
                    <p id="delete-modal-message" class="text-sm text-slate-600">Delete this record?</p>
                    <div id="delete-modal-error" class="hidden p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200"></div>

                    <div class="pt-2 flex justify-end gap-2">
                        <button type="button" onclick="hideModal('delete-modal')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                        <button type="button" id="delete-modal-confirm-btn" class="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 focus:ring-2 focus:ring-rose-600 transition-all">Delete</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(delDiv);
    }

    if (!document.getElementById('receipt-modal')) {
        const rcptDiv = document.createElement('div');
        rcptDiv.id = 'receipt-modal';
        rcptDiv.className = 'modal-root hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        rcptDiv.innerHTML = `
            <div class="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div class="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0">
                    <div>
                        <span class="text-xl font-black tracking-tight">Scamazon<span class="text-amber-400">.</span></span>
                        <p id="receipt-order-id" class="text-sm font-mono text-slate-300 mt-1 font-semibold">Order #0000</p>
                    </div>
                    <button onclick="hideModal('receipt-modal')" class="text-slate-400 hover:text-white text-2xl leading-none focus:outline-none">&times;</button>
                </div>

                <div class="p-6 overflow-y-auto space-y-6 text-sm">
                    <div class="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-slate-200">
                        <div>
                            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Storefront Branch</p>
                            <p id="receipt-branch-name" class="font-bold text-slate-900 mt-0.5">-</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                            <span id="receipt-status-badge" class="inline-block mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border bg-slate-100 text-slate-900 border-slate-200">Processing</span>
                        </div>
                    </div>

                    <div>
                        <p class="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Date & Time Placed</p>
                        <p id="receipt-date-time" class="font-medium text-slate-800 mt-1">-</p>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th class="py-2.5 px-3">Item Description</th>
                                    <th class="py-2.5 px-3 text-center">Qty</th>
                                    <th class="py-2.5 px-3 text-right">Unit Price</th>
                                    <th class="py-2.5 px-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody id="receipt-items-tbody" class="divide-y divide-slate-100 font-mono text-[11px]">
                            </tbody>
                        </table>
                    </div>

                    <div class="space-y-1.5 pt-2 text-xs border-t border-dashed border-slate-200">
                        <div class="flex justify-between text-slate-600">
                            <span>Items Subtotal</span>
                            <span id="receipt-subtotal" class="font-mono text-slate-900 font-medium">$0.00</span>
                        </div>
                        <div class="flex justify-between text-slate-600">
                            <span>Estimated State Tax (8.25%)</span>
                            <span id="receipt-tax" class="font-mono text-slate-900 font-medium">$0.00</span>
                        </div>
                        <div class="flex justify-between items-center text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                            <span class="text-base">Total Cost</span>
                            <span id="receipt-total" class="text-base font-mono text-slate-900">$0.00</span>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <button onclick="window.print()" class="text-xs font-semibold text-slate-600 hover:text-slate-900 underline transition-colors focus:outline-none">
                        Print Receipt
                    </button>
                    <button onclick="hideModal('receipt-modal')" class="px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-sm">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(rcptDiv);
    }

    initDeleteModalHandler();
}

/**
 * Shared Logout Controller for all portals.
 */
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.dataset.bound = 'true';
        logoutBtn.addEventListener('click', async () => {
            const clientInstance = (typeof window !== 'undefined' && window.client) ? window.client : (typeof client !== 'undefined' ? client : null);
            if (clientInstance && clientInstance.auth) {
                try {
                    await clientInstance.auth.signOut();
                } catch (e) {
                    console.warn('SignOut error:', e);
                }
            }
            window.location.replace('login');
        });
    }
}

// Auto-initialize shared modals and logout bindings when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectSharedModals();
            setupLogoutButton();
        });
    } else {
        injectSharedModals();
        setupLogoutButton();
    }
}
