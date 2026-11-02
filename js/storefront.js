/**
 * Scamazon - Storefront Dealer Panel Logic
 */
let branchStorefront = null;
        let currentManager = null;

        const state = {
            listings: [],
            workers: [],
            orders: []
        };
let pendingWorker = null;

        

        

        

        

        async function init() {
            try {
                const { data: { session }, error: sessionErr } = await client.auth.getSession();
                if (sessionErr || !session) {
                    window.location.replace('login.html');
                    return;
                }

                const { data: user, error: userErr } = await client
                    .from('users')
                    .select('*')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (userErr || !user || user.role !== 'storefront_owner') {
                    await client.auth.signOut();
                    window.location.replace('login.html?unauthorized=1');
                    return;
                }

                if (!user.storefront) {
                    alert('Your account is not linked to any storefront. Please contact the administrator.');
                    await client.auth.signOut();
                    window.location.replace('login.html');
                    return;
                }

                currentManager = user;
                branchStorefront = user.storefront;

                document.getElementById('user-display').textContent = session.user.email;
                document.getElementById('storefront-pill').innerHTML = `
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                    ${branchStorefront}
                `;
                document.getElementById('modal-storefront-display').value = branchStorefront;
                document.getElementById('worker-storefront-display').value = branchStorefront;

                await loadAll();
            } catch (err) {
                window.location.replace('login.html');
            }
        }

        async function loadAll() {
            if (!branchStorefront) return;

            const [listRes, workRes, ordRes] = await Promise.all([
                client.from('listings').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false }),
                client.from('users').select('*').eq('role', 'worker').eq('storefront', branchStorefront).order('created_at', { ascending: false }),
                client.from('orders').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false })
            ]);

            state.listings = listRes.data || [];
            state.workers = workRes.data || [];
            state.orders = ordRes.data || [];

            renderListings();
            renderWorkers();
            renderOrders();
            renderSales();
        }

        // ==========================================
        // SALES & ANALYTICS
        // ==========================================

        function renderSales() {
            const tbody = document.getElementById('sales-storefronts-tbody');
            let branchRev = 0;
            let branchUnits = 0;

            state.orders.forEach(o => {
                if (typeof o.items === 'string') {
                    const countMatch = o.items.match(/(\d+)\s*x/i);
                    const count = countMatch ? parseInt(countMatch[1], 10) : 1;
                    branchUnits += count;

                    const matchedItem = state.listings.find(l => 
                        (l.sku && o.items.includes(l.sku)) || 
                        (l.title && o.items.toLowerCase().includes(l.title.toLowerCase()))
                    );
                    
                    if (matchedItem) {
                        branchRev += (parseFloat(matchedItem.price) || 0) * count;
                    }
                }
            });

            document.getElementById('stat-sales-rev').textContent = `$${branchRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            document.getElementById('stat-sales-orders').textContent = state.orders.length;

            if (!state.orders.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">No sales records available for this storefront.</td></tr>';
                return;
            }

            tbody.innerHTML = `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-4 font-medium text-slate-900">${sanitizeHtml(branchStorefront)}</td>
                    <td class="py-3 px-4 text-xs text-slate-600">${state.orders.length}</td>
                    <td class="py-3 px-4 text-xs text-slate-600">${branchUnits}</td>
                    <td class="py-3 px-4 text-right font-semibold text-slate-900">$${branchRev.toFixed(2)}</td>
                </tr>
            `;
        }

        /* --- LISTINGS --- */

        function renderListings() {
            const search = document.getElementById('search-input').value.toLowerCase().trim();
            const tbody = document.getElementById('listings-tbody');

            const itemsList = state.listings.filter(i => {
                const title = (i.title || '').toLowerCase();
                const sku = (i.sku || '').toLowerCase();
                return title.includes(search) || sku.includes(search);
            });

            document.getElementById('stat-total').textContent = state.listings.length;
            document.getElementById('stat-low').textContent = state.listings.filter(i => i.stock > 0 && i.stock < 10).length;
            document.getElementById('stat-units').textContent = state.listings.reduce((acc, curr) => acc + (parseInt(curr.stock, 10) || 0), 0);
            document.getElementById('badge-listings').textContent = state.listings.length;

            if (!itemsList.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">No listings found for this storefront.</td></tr>';
                return;
            }

            tbody.innerHTML = itemsList.map(item => {
                let badge = `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium rounded-md">${item.stock}</span>`;
                if (item.stock === 0) badge = '<span class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium rounded-md">Out of Stock</span>';
                else if (item.stock < 10) badge = `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-md">Low (${item.stock})</span>`;

                const img = item.image_url 
                    ? `<img src="${sanitizeHtml(item.image_url)}" alt="${sanitizeHtml(item.title)}" class="w-8 h-8 object-cover rounded-md border border-slate-200">`
                    : '<div class="w-8 h-8 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-mono">-</div>';

                return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-3 px-4 flex items-center gap-3">
                            ${img}
                            <div>
                                <div class="font-medium text-slate-900">${sanitizeHtml(item.title)}</div>
                                <div class="text-xs text-slate-500">${sanitizeHtml(item.storefront)}</div>
                            </div>
                        </td>
                        <td class="py-3 px-4 text-xs font-mono text-slate-600">${sanitizeHtml(item.sku)}</td>
                        <td class="py-3 px-4 text-xs text-slate-600">${sanitizeHtml(item.storefront)}</td>
                        <td class="py-3 px-4 text-sm font-semibold text-slate-900">$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                        <td class="py-3 px-4">${badge}</td>
                        <td class="py-3 px-4 text-right space-x-2">
                            <button onclick="editListing('${sanitizeHtml(item.id)}')" class="text-xs font-medium text-slate-900 hover:text-slate-950 transition">Edit</button>
                            <button onclick="removeListing('${sanitizeHtml(item.id)}')" class="text-xs font-medium text-rose-600 hover:text-rose-800 transition">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function editListing(id) {
            const item = state.listings.find(x => x.id === id);
            if (!item) return;
            document.getElementById('modal-title').textContent = 'Edit Listing';
            document.getElementById('modal-item-id').value = item.id;
            document.getElementById('modal-title-input').value = item.title || '';
            document.getElementById('modal-sku').value = item.sku || '';
            document.getElementById('modal-price').value = item.price || '';
            document.getElementById('modal-stock').value = item.stock || 0;
            document.getElementById('modal-image').value = item.image_url || '';
            showModal('listing-modal');
        }

        function removeListing(id) {
            askDelete('Delete Listing', `Delete this listing? It won't come back.`, async () => {
                const { error } = await client.from('listings').delete().eq('id', id).eq('storefront', branchStorefront);
                if (error) throw error;
                state.listings = state.listings.filter(x => x.id !== id);
                renderListings();
            });
        }

        document.getElementById('listing-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('modal-submit-btn');
            const err = document.getElementById('listingError');
            btn.disabled = true;

            const id = document.getElementById('modal-item-id').value;
            const payload = {
                title: document.getElementById('modal-title-input').value.trim(),
                sku: document.getElementById('modal-sku').value.trim(),
                price: parseFloat(document.getElementById('modal-price').value),
                stock: parseInt(document.getElementById('modal-stock').value, 10),
                storefront: branchStorefront,
                image_url: document.getElementById('modal-image').value.trim() || null
            };

            try {
                const query = id 
                    ? client.from('listings').update(payload).eq('id', id).eq('storefront', branchStorefront) 
                    : client.from('listings').insert([payload]);
                const { error } = await query;
                if (error) throw error;

                hideModal('listing-modal');
                document.getElementById('listing-form').reset();
                document.getElementById('modal-item-id').value = '';
                
                const { data: refreshed } = await client.from('listings').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false });
                state.listings = refreshed || [];
                renderListings();
            } catch (e) {
                err.textContent = e.code === '23505' ? 'That SKU already exists in the system.' : e.message;
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
            }
        });

        /* --- WORKERS --- */

        function renderWorkers() {
            const search = document.getElementById('worker-search-input').value.toLowerCase().trim();
            const tbody = document.getElementById('workers-tbody');
            document.getElementById('badge-workers').textContent = state.workers.length;

            let htmlStr = '';
            
            state.workers.forEach(w => {
                const name = (w.name || '').toLowerCase();
                const email = (w.email || '').toLowerCase();
                
                if (name.includes(search) || email.includes(search)) {
                    htmlStr += `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-3 px-4">
                                <div class="font-medium text-slate-900">${sanitizeHtml(w.name || 'Unnamed Worker')}</div>
                                <div class="text-xs font-mono text-slate-500">${sanitizeHtml(w.email)}</div>
                            </td>
                            <td class="py-3 px-4 text-sm text-slate-600">${sanitizeHtml(w.storefront)}</td>
                            <td class="py-3 px-4">
                                <span class="px-2 py-0.5 ${w.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'} text-xs font-medium rounded-md">${sanitizeHtml(w.status)}</span>
                            </td>
                            <td class="py-3 px-4 text-right space-x-2">
                                <button onclick="removeWorker('${sanitizeHtml(w.id)}')" class="text-xs font-medium text-rose-600 hover:text-rose-800 transition">
                                    Revoke Access
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });

            tbody.innerHTML = htmlStr || '<tr><td colspan="4" class="p-6 text-center text-slate-500">No workers found for this storefront.</td></tr>';
        }


        function removeWorker(id) {
            askDelete(
                'Revoke Access',
                `Revoke this worker's access to ${branchStorefront}?`,
                async () => {
                    const { error } = await client.rpc('revoke_worker', {
                        p_worker_id: id
                    });

                    if (error) throw error;

                    // The user is now a customer, so remove them
                    // from this storefront's worker list immediately.
                    state.workers = state.workers.filter(worker => worker.id !== id);

                    renderWorkers();
                },
                'Revoke Access'
            );
        }

        document.getElementById('worker-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('worker-email').value.trim();
            pendingWorker = {
                payload: {
                    name: document.getElementById('worker-name').value.trim(),
                    email,
                    storefront: branchStorefront,
                    status: document.getElementById('worker-status').value,
                    role: 'worker'
                }
            };
            hideModal('worker-modal');
            document.getElementById('target-email-display').textContent = email;
            document.getElementById('confirm-email-input').value = '';
            showModal('confirm-email-modal');
        });

        document.getElementById('confirm-email-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!pendingWorker) return;

            const input = document.getElementById('confirm-email-input').value.trim();
            const errorBox = document.getElementById('confirm-email-error');

            errorBox.textContent = '';
            errorBox.classList.add('hidden');

            if (input.toLowerCase() !== pendingWorker.payload.email.toLowerCase()) {
                errorBox.textContent = 'The email addresses do not match.';
                errorBox.classList.remove('hidden');
                return;
            }

            try {
                const { data: user, error: lookupError } = await client
                    .from('users')
                    .select('id, name, role, storefront')
                    .eq('email', pendingWorker.payload.email)
                    .maybeSingle();

                if (lookupError) throw lookupError;

                if (!user) {
                    errorBox.textContent =
                        'No Scamazon account exists with this email. The worker must create an account first.';
                    errorBox.classList.remove('hidden');
                    return;
                }

                if (user.role === 'owner' || user.role === 'storefront_owner') {
                    errorBox.textContent =
                        'This account already has management access and cannot be assigned as a worker.';
                    errorBox.classList.remove('hidden');
                    return;
                }

                if (
                    user.role === 'worker' &&
                    user.storefront &&
                    user.storefront !== branchStorefront
                ) {
                    errorBox.textContent =
                        `This worker is already assigned to ${user.storefront}.`;
                    errorBox.classList.remove('hidden');
                    return;
                }

                const { error: updateError } = await client
                    .from('users')
                    .update({
                        name: pendingWorker.payload.name || user.name,
                        storefront: branchStorefront,
                        status: pendingWorker.payload.status,
                        role: 'worker'
                    })
                    .eq('id', user.id);

                if (updateError) throw updateError;

                const { data: refreshed, error: refreshError } = await client
                    .from('users')
                    .select('*')
                    .eq('role', 'worker')
                    .eq('storefront', branchStorefront)
                    .order('created_at', { ascending: false });

                if (refreshError) throw refreshError;

                state.workers = refreshed || [];
                renderWorkers();

                hideModal('confirm-email-modal');
                document.getElementById('worker-form').reset();
                document.getElementById('worker-storefront-display').value = branchStorefront;
                pendingWorker = null;

            } catch (ex) {
                console.error('Worker save error:', ex);

                errorBox.textContent =
                    ex.message || 'Could not add this worker. Please try again.';
                errorBox.classList.remove('hidden');
            }
        });

        /* --- ORDERS --- */

        function renderOrders() {
            const search = document.getElementById('orders-search-input').value.toLowerCase().trim();
            const status = document.getElementById('orders-filter-status').value;
            const tbody = document.getElementById('global-orders-tbody');

            const rows = state.orders.filter(o => {
                const orderNum = (o.order_number || '').toLowerCase();
                const itemsStr = (o.items || '').toLowerCase();
                const matchSearch = orderNum.includes(search) || itemsStr.includes(search);
                const currentStatus = o.status === 'Ready for Driver' ? 'Shipped' : (o.status || 'Processing');
                const matchStatus = !status || o.status === status || currentStatus === status;
                return matchSearch && matchStatus;
            });

            document.getElementById('stat-ord-total').textContent = state.orders.length;
            document.getElementById('stat-ord-processing').textContent = state.orders.filter(o => o.status === 'Processing').length;
            document.getElementById('stat-ord-ready').textContent = state.orders.filter(o => ['Ready for Driver', 'Shipped', 'Out for Delivery', 'Delivered'].includes(o.status)).length;
            document.getElementById('badge-orders').textContent = state.orders.length;
            
            tbody.innerHTML = '';

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">No orders found for this storefront.</td></tr>';
                return;
            }

            rows.forEach(o => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors';
                
                const formattedDate = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-';
                const currentStatus = o.status === 'Ready for Driver' ? 'Shipped' : (o.status || 'Processing');
                
                tr.innerHTML = `
                    <td class="py-3 px-4">
                        <button onclick="viewOrderReceipt('${sanitizeHtml(o.id)}')" class="font-mono font-semibold text-sm text-amber-600 hover:text-amber-700 hover:underline transition-colors focus:outline-none">
                            ${sanitizeHtml(o.order_number)}
                        </button>
                    </td>
                    <td class="py-3 px-4 text-sm text-slate-600">${sanitizeHtml(o.storefront)}</td>
                    <td class="py-3 px-4 text-sm text-slate-700">${sanitizeHtml(o.items)}</td>
                    <td class="py-3 px-4">
                        <select onchange="updateOrderStatus('${sanitizeHtml(o.id)}', this.value)" class="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer">
                            <option value="Processing" ${currentStatus === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${currentStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Out for Delivery" ${currentStatus === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    </td>
                    <td class="py-3 px-4 text-right text-sm text-slate-400">${formattedDate}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        window.updateOrderStatus = (orderId, newStatus) => updateOrderStatusHelper(orderId, newStatus, state.orders, () => {
            renderOrders();
            renderSales();
        });

        window.viewOrderReceipt = (orderId) => viewOrderReceiptHelper(orderId, state.orders, state.listings, branchStorefront);

        const filterBindings = [
            ['search-input', 'input', renderListings],
            ['worker-search-input', 'input', renderWorkers],
            ['orders-search-input', 'input', renderOrders],
            ['orders-filter-status', 'change', renderOrders]
        ];

        filterBindings.forEach(([id, event, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        });
        

        window.addEventListener('focus', async () => {
            if (branchStorefront) {
                await loadAll();
            }
        });

        init();
