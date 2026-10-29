/**
 * Scamazon - Warehouse Worker Dashboard Logic
 */
let currentWorker = null;

        const state = {
            listings: [],
            orders: []
        };

        let onConfirmDelete = null;

        

        

        

        function askDelete(title, msg, fn) {
            document.getElementById('delete-modal-title').textContent = title;
            document.getElementById('delete-modal-message').textContent = msg;
            onConfirmDelete = fn;
            showModal('delete-modal');
        }

        document.getElementById('delete-modal-confirm-btn').addEventListener('click', async () => {
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
                err.textContent = e.message || 'Action failed.';
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Delete';
            }
        });

        function switchTab(tab) {
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
                orders: 'Orders & Fulfillment',
                sales: 'Sales & Analytics'
            };
            document.getElementById('page-heading').textContent = titles[tab] || 'Worker Panel';
        }

        async function init() {
            try {
                const { data: { session }, error: sessionErr } = await client.auth.getSession();
                if (sessionErr || !session) {
                    window.location.replace('login');
                    return;
                }

                const { data: user, error: userErr } = await client
                    .from('users')
                    .select('*')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (userErr || !user) {
                    await client.auth.signOut();
                    window.location.replace('login?unauthorized=1');
                    return;
                }

                if (user.role === 'customer') {
                    window.location.replace('customer');
                    return;
                }

                if (user.role !== 'worker' || user.status === 'Suspended') {
                    await client.auth.signOut();
                    window.location.replace('login?unauthorized=1');
                    return;
                }

                currentWorker = user;
                document.getElementById('user-display').textContent = session.user.email;
                document.getElementById('worker-pill').innerHTML = `
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                    ${currentWorker.name || currentWorker.email} &bull; ${currentWorker.storefront || 'Unassigned Branch'}
                `;
                document.getElementById('modal-storefront-display').value = currentWorker.storefront || '';

                await loadAll();
            } catch (err) {
                window.location.replace('login');
            }
        }

        async function loadAll() {
            if (!currentWorker.storefront) return;

            const [listRes, ordRes] = await Promise.all([
                client.from('listings').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false }),
                client.from('orders').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false })
            ]);

            state.listings = listRes.data || [];
            state.orders = ordRes.data || [];

            renderListings();
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
                    <td class="py-3 px-4 font-medium text-slate-900">${sanitizeHtml(currentWorker.storefront)}</td>
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
                const { error } = await client.from('listings').delete().eq('id', id).eq('storefront', currentWorker.storefront);
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
                storefront: currentWorker.storefront,
                image_url: document.getElementById('modal-image').value.trim() || null
            };

            try {
                const query = id 
                    ? client.from('listings').update(payload).eq('id', id).eq('storefront', currentWorker.storefront) 
                    : client.from('listings').insert([payload]);
                const { error } = await query;
                if (error) throw error;

                hideModal('listing-modal');
                document.getElementById('listing-form').reset();
                document.getElementById('modal-item-id').value = '';
                
                const { data: refreshed } = await client.from('listings').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false });
                state.listings = refreshed || [];
                renderListings();
            } catch (e) {
                err.textContent = e.code === '23505' ? 'That SKU already exists in the system.' : e.message;
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
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

        async function updateOrderStatus(orderId, newStatus) {
            const order = state.orders.find(o => o.id === orderId);
            if (!order) return;

            const dbStatus = newStatus === 'Shipped' ? 'Ready for Driver' : newStatus;

            try {
                const { error } = await client
                    .from('orders')
                    .update({ status: dbStatus })
                    .eq('id', orderId);

                if (error) {
                    if (error.code === '23514' && newStatus === 'Delivered') {
                        const { error: fallbackErr } = await client
                            .from('orders')
                            .update({ status: 'Out for Delivery' })
                            .eq('id', orderId);
                        if (fallbackErr) throw fallbackErr;
                    } else {
                        throw error;
                    }
                }

                order.status = (newStatus === 'Shipped') ? 'Ready for Driver' : newStatus;
                renderOrders();
                renderSales();
            } catch (err) {
                console.error('Failed to update order status:', err);
                alert('Could not update order status: ' + (err.message || 'Unknown error'));
                renderOrders();
            }
        }
        window.updateOrderStatus = updateOrderStatus;

        function viewOrderReceipt(orderId) {
            const order = state.orders.find(o => o.id === orderId);
            if (!order) return;

            document.getElementById('receipt-order-id').textContent = order.order_number || ('Order #' + order.id.slice(0, 6));
            document.getElementById('receipt-branch-name').textContent = order.storefront || currentWorker.storefront;

            const d = order.created_at ? new Date(order.created_at) : new Date();
            const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const formattedTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            document.getElementById('receipt-date-time').textContent = `${formattedDate} at ${formattedTime}`;

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

                    const matchedListing = state.listings.find(l => 
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
                            <td class="py-2.5 px-3 text-right text-slate-600">$${unitPrice.toFixed(2)}</td>
                            <td class="py-2.5 px-3 text-right font-semibold text-slate-900">$${lineTotal.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            if (!itemRows) {
                itemRows = `<tr><td colspan="4" class="p-3 text-center text-slate-400">No item details recorded.</td></tr>`;
            }
            tbody.innerHTML = itemRows;

            const tax = subtotal * 0.0825;
            const total = subtotal + tax;

            document.getElementById('receipt-subtotal').textContent = `$${subtotal.toFixed(2)}`;
            document.getElementById('receipt-tax').textContent = `$${tax.toFixed(2)}`;
            document.getElementById('receipt-total').textContent = `$${total.toFixed(2)}`;

            showModal('receipt-modal');
        }

        const filterBindings = [
            ['search-input', 'input', renderListings],
            ['orders-search-input', 'input', renderOrders],
            ['orders-filter-status', 'change', renderOrders]
        ];

        filterBindings.forEach(([id, event, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await client.auth.signOut();
            window.location.replace('login');
        });
        window.addEventListener('focus', async () => {
            if (currentWorker) {
                await init();
            }
        });
        
        init();
