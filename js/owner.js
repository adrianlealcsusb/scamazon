/**
 * Scamazon - Owner & Executive Management Dashboard Logic
 */
const state = {
            listings: [],
            storefronts: [],
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
                    .select('role')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (userErr || !user || user.role !== 'owner') {
                    await client.auth.signOut();
                    window.location.replace('login.html?unauthorized=1');
                    return;
                }

                document.getElementById('user-display').textContent = session.user.email;
                await loadAll();
            } catch (err) {
                window.location.replace('login.html');
            }
        }

        async function loadAll() {
            const [sfRes, listRes, workRes, ordRes] = await Promise.all([
                client.from('storefronts').select('*').order('created_at', { ascending: false }),
                client.from('listings').select('*').order('created_at', { ascending: false }),
                client.from('users').select('*').eq('role', 'worker').order('created_at', { ascending: false }),
                client.from('orders').select('*').order('created_at', { ascending: false })
            ]);

            state.storefronts = sfRes.data || [];
            state.listings = listRes.data || [];
            state.workers = workRes.data || [];
            state.orders = ordRes.data || [];

            syncDropdowns();
            renderListings();
            renderStorefronts();
            renderWorkers();
            renderOrders();
            renderSales();
        }

        function syncDropdowns() {
            const activeOptions = state.storefronts
                .filter(s => s.status === 'Active')
                .map(s => `<option value="${sanitizeHtml(s.name)}">${sanitizeHtml(s.name)}</option>`)
                .join('');

            ['filter-storefront', 'worker-filter-storefront'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<option value="">All Storefronts</option>' + activeOptions;
            });

            ['modal-storefront', 'worker-storefront'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = activeOptions;
            });
        }

        // ==========================================
        // SALES & ANALYTICS
        // ==========================================

        function renderSales() {
            const tbody = document.getElementById('sales-storefronts-tbody');
            let grandTotal = 0;
            let totalSold = 0;

            const summary = state.storefronts.map(sf => {
                const sfOrders = state.orders.filter(o => o.storefront === sf.name);
                let sfRev = 0;
                let sfUnits = 0;

                sfOrders.forEach(o => {
                    if (typeof o.items === 'string') {
                        const countMatch = o.items.match(/(\d+)\s*x/i);
                        const count = countMatch ? parseInt(countMatch[1], 10) : 1;
                        sfUnits += count;

                        const matchedItem = state.listings.find(l => 
                            (l.sku && o.items.includes(l.sku)) || 
                            (l.title && o.items.toLowerCase().includes(l.title.toLowerCase()))
                        );
                        
                        if (matchedItem) {
                            sfRev += (parseFloat(matchedItem.price) || 0) * count;
                        }
                    }
                });

                grandTotal += sfRev;
                totalSold += sfUnits;

                return {
                    name: sf.name,
                    orders: sfOrders.length,
                    units: sfUnits,
                    revenue: sfRev
                };
            });

            document.getElementById('stat-sales-rev').textContent = `$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            document.getElementById('stat-sales-orders').textContent = state.orders.length;

            if (!summary.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">No sales records available.</td></tr>';
                return;
            }

            tbody.innerHTML = summary.map(b => `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-4 font-medium text-slate-900">${sanitizeHtml(b.name)}</td>
                    <td class="py-3 px-4 text-xs text-slate-600">${b.orders}</td>
                    <td class="py-3 px-4 text-xs text-slate-600">${b.units}</td>
                    <td class="py-3 px-4 text-right font-semibold text-slate-900">$${b.revenue.toFixed(2)}</td>
                </tr>
            `).join('');
        }

        /* --- LISTINGS --- */

        let sortState = { key: null, dir: 1};
        function sortItems(items)
        {
            if (!sortState.key) return items;
            const { key, dir } = sortState;

            return [...items].sort((a, b) => {
                let valA = a[key];
                let valB = b[key];

                if (key === 'price')
                {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                }
                else if (key === 'stock') 
                {
                    valA = parseInt(valA) || 0;
                    valB = parseInt(valB) || 0;
                }
                else
                {
                    valA = (valA || '').toString().toLowerCase();
                    valB = (valB || '').toString().toLowerCase();
                }
                
                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
            });
        }

        function updateSortIcons()
        {
            document.querySelectorAll('[data-sort]').forEach(th => {
                const icon = th.querySelector('.sort-icon');
                if (th.dataset.sort === sortState.key)
                {
                    icon.textContent = sortState.dir === 1 ? '↑' : '↓';
                    icon.classList.remove('text-slate-300');
                    icon.classList.add('text-slate-600');
                }
                else
                {
                    icon.textContent = '↕';
                    icon.classList.remove('text-slate-600');
                    icon.classList.add('text-slate-300');
                }
            });
        }

        document.querySelectorAll('[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (sortState.key === key)
                {
                    sortState.dir *= -1;
                }
                else
                {
                    sortState.key = key;
                    sortState.dir = 1;
                }

                updateSortIcons();
                renderListings();
            })
        });

        function renderListings() {
            const search = document.getElementById('search-input').value.toLowerCase().trim();
            const filterSf = document.getElementById('filter-storefront').value;
            const tbody = document.getElementById('listings-tbody');

            let itemsList = state.listings.filter(i => {
                const title = (i.title || '').toLowerCase();
                const sku = (i.sku || '').toLowerCase();
                const matchSearch = title.includes(search) || sku.includes(search);
                const matchStore = !filterSf || i.storefront === filterSf;
                return matchSearch && matchStore;
            });

            itemsList = sortItems(itemsList);

            document.getElementById('stat-total').textContent = state.listings.length;
            document.getElementById('stat-low').textContent = state.listings.filter(i => i.stock > 0 && i.stock < 10).length;
            document.getElementById('stat-units').textContent = state.listings.reduce((acc, curr) => acc + (parseInt(curr.stock, 10) || 0), 0);
            document.getElementById('badge-listings').textContent = state.listings.length;

            if (!itemsList.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">No listings found.</td></tr>';
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
            document.getElementById('modal-storefront').value = item.storefront || '';
            document.getElementById('modal-image').value = item.image_url || '';
            showModal('listing-modal');
        }

        function removeListing(id) {
            askDelete('Delete Listing', `Delete this listing? It won't come back.`, async () => {
                const { error } = await client.from('listings').delete().eq('id', id);
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
                storefront: document.getElementById('modal-storefront').value,
                image_url: document.getElementById('modal-image').value.trim() || null
            };

            try {
                const query = id ? client.from('listings').update(payload).eq('id', id) : client.from('listings').insert([payload]);
                const { error } = await query;
                if (error) throw error;

                hideModal('listing-modal');
                document.getElementById('listing-form').reset();
                document.getElementById('modal-item-id').value = '';
                
                const { data: refreshed } = await client.from('listings').select('*').order('created_at', { ascending: false });
                state.listings = refreshed || [];
                renderListings();
            } catch (e) {
                err.textContent = e.code === '23505' ? 'That SKU already exists in the system.' : e.message;
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
            }
        });


        // STOREFRONTS

        function renderStorefronts() {
            const search = document.getElementById('sf-search-input').value.toLowerCase().trim();
            const status = document.getElementById('sf-filter-status').value;
            const tbody = document.getElementById('storefronts-tbody');
            
            document.getElementById('badge-storefronts').textContent = state.storefronts.length;

            let output = '';
            for (let i = 0; i < state.storefronts.length; i++) {
                const s = state.storefronts[i];
                
                const nameMatch = (s.name || '').toLowerCase().includes(search);
                const addrMatch = (s.address || '').toLowerCase().includes(search);
                const statMatch = !status || s.status === status;
                
                if ((nameMatch || addrMatch) && statMatch) {
                    const sfListings = state.listings.filter(l => l.storefront === s.name);
                    const staffCount = state.workers.filter(w => w.storefront === s.name && w.status === 'Active').length;
                    
                    const badgeClass = s.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200';

                    output += `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-3 px-4">
                                <div class="font-medium text-slate-900">${sanitizeHtml(s.name)}</div>
                                <div class="text-xs text-slate-500">${sanitizeHtml(s.address)}</div>
                            </td>
                            <td class="py-3 px-4 text-xs text-slate-600">${sanitizeHtml(s.hours) || '-'}</td>
                            <td class="py-3 px-4 text-xs text-slate-600">
                                ${staffCount} Staff / ${sfListings.length} SKUs
                            </td>
                            <td class="py-3 px-4">
                                <span class="px-2 py-0.5 ${badgeClass} text-xs font-medium rounded-md">${sanitizeHtml(s.status)}</span>
                            </td>
                            <td class="py-3 px-4 text-right space-x-2">
                                <button onclick="editStorefront('${sanitizeHtml(s.id)}')" class="text-xs font-medium text-slate-900 hover:text-slate-950 transition">Edit</button>
                                <button onclick="removeStorefront('${sanitizeHtml(s.id)}', '${sanitizeHtml(s.name)}')" class="text-xs font-medium text-rose-600 hover:text-rose-800 transition">Delete</button>
                            </td>
                        </tr>
                    `;
                }
            }

            if (!output) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">No storefronts found.</td></tr>';
            } else {
                tbody.innerHTML = output;
            }
        }

        function editStorefront(id) {
            const sf = state.storefronts.find(x => x.id === id);
            if (!sf) return;
            document.getElementById('sf-modal-title').textContent = 'Edit Storefront';
            document.getElementById('sf-modal-id').value = sf.id;
            document.getElementById('sf-name').value = sf.name || '';
            document.getElementById('sf-address').value = sf.address || '';
            document.getElementById('sf-hours').value = sf.hours || '';
            document.getElementById('sf-status').value = sf.status || 'Active';
            showModal('storefront-modal');
        }

        async function removeStorefront(id, name) {
            const attached = state.listings.filter(l => l.storefront === name);
            if (attached.length > 0) {
                if (!confirm(`WARNING: ${name} still has ${attached.length} active listings!\n\nIf you delete this location, those listings will become unassigned. Are you sure you want to proceed?`)) return;
            } else {
                if (!confirm(`Permanently delete location: ${name}?`)) return;
            }
            
            try {
                const { error } = await client.from('storefronts').delete().eq('id', id);
                if (error) throw error;
                state.storefronts = state.storefronts.filter(x => x.id !== id);
                syncDropdowns();
                renderStorefronts();
            } catch (err) {
                console.error(err);
                alert("Failed to delete storefront.");
            }
        }

        document.getElementById('storefront-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('sf-modal-id').value;
            const payload = {
                name: document.getElementById('sf-name').value.trim(),
                address: document.getElementById('sf-address').value.trim(),
                hours: document.getElementById('sf-hours').value.trim(),
                status: document.getElementById('sf-status').value
            };

            const query = id ? client.from('storefronts').update(payload).eq('id', id) : client.from('storefronts').insert([payload]);
            const { error } = await query;
            
            if (error) {
                console.error(error);
                document.getElementById('sfErrBox').textContent = 'Something went wrong saving the location.';
                document.getElementById('sfErrBox').classList.remove('hidden');
                return;
            }

            hideModal('storefront-modal');
            document.getElementById('storefront-form').reset();
            document.getElementById('sf-modal-id').value = '';
            
            const { data: refreshed } = await client.from('storefronts').select('*').order('created_at', { ascending: false });
            state.storefronts = refreshed || [];
            syncDropdowns();
            renderStorefronts();
        });

        // WORKERS AND ORDERS BEYOND THIS POINT

        function renderWorkers() {
            const search = document.getElementById('worker-search-input').value.toLowerCase().trim();
            const sf = document.getElementById('worker-filter-storefront').value;
            const tbody = document.getElementById('workers-tbody');
            document.getElementById('badge-workers').textContent = state.workers.length;

            let htmlStr = '';
            
            state.workers.forEach(w => {
                const name = (w.name || '').toLowerCase();
                const email = (w.email || '').toLowerCase();
                
                if ((name.includes(search) || email.includes(search)) && (!sf || w.storefront === sf)) {
                    htmlStr += `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-3 px-4">
                                <div class="font-medium text-slate-900">${sanitizeHtml(w.name || 'Unnamed Worker')}</div>
                                <div class="text-xs font-mono text-slate-500">${sanitizeHtml(w.email)}</div>
                            </td>
                            <td class="py-3 px-4 text-sm text-slate-600">${sanitizeHtml(w.storefront) || 'Unassigned'}</td>
                            <td class="py-3 px-4">
                                <span class="px-2 py-0.5 ${w.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'} text-xs font-medium rounded-md">${sanitizeHtml(w.status)}</span>
                            </td>
                            <td class="py-3 px-4 text-right space-x-2">
                                <button onclick="removeWorker('${sanitizeHtml(w.id)}')" class="text-xs font-medium text-rose-600 hover:text-rose-800 transition">Revoke Access</button>
                            </td>
                        </tr>
                    `;
                }
            });

            tbody.innerHTML = htmlStr || '<tr><td colspan="4" class="p-6 text-center text-slate-500">No workers found.</td></tr>';
        }

        function removeWorker(id) {
            askDelete('Revoke Access', `Remove this worker's access?`, async () => {
                const { error } = await client.from('users').delete().eq('id', id);
                if (error) throw error;
                state.workers = state.workers.filter(x => x.id !== id);
                renderWorkers();
            });
        }

        document.getElementById('worker-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('worker-email').value.trim();
            pendingWorker = {
                payload: {
                    name: document.getElementById('worker-name').value.trim(),
                    email,
                    storefront: document.getElementById('worker-storefront').value,
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
            
            if (input.toLowerCase() !== pendingWorker.payload.email.toLowerCase()) {
                console.error('Email verification did not match.');
                return;
            }

            try {
                const { data: user } = await client.from('users').select('id, name').eq('email', pendingWorker.payload.email).maybeSingle();
                if (user) {
                    await client.from('users').update({
                        name: pendingWorker.payload.name || user.name,
                        storefront: pendingWorker.payload.storefront,
                        status: pendingWorker.payload.status,
                        role: 'worker'
                    }).eq('id', user.id);
                } else {
                    console.error('No account found for', pendingWorker.payload.email);
                }

                hideModal('confirm-email-modal');
                pendingWorker = null;
                const { data: refreshed } = await client.from('users').select('*').eq('role', 'worker').order('created_at', { ascending: false });
                state.workers = refreshed || [];
                renderWorkers();
            } catch (ex) {
                console.error("Worker save error:", ex);
            }
        });

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
                tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500">No orders found.</td></tr>';
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

        window.viewOrderReceipt = (orderId) => viewOrderReceiptHelper(orderId, state.orders, state.listings, 'Central Depot');

        const filterBindings = [
            ['search-input', 'input', renderListings],
            ['filter-storefront', 'change', renderListings],
            ['sf-search-input', 'input', renderStorefronts],
            ['sf-filter-status', 'change', renderStorefronts],
            ['worker-search-input', 'input', renderWorkers],
            ['worker-filter-storefront', 'change', renderWorkers],
            ['orders-search-input', 'input', renderOrders],
            ['orders-filter-status', 'change', renderOrders]
        ];

        filterBindings.forEach(([id, event, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        });

        window.addEventListener('focus', async () => {
            await loadAll();
        });

        init();
