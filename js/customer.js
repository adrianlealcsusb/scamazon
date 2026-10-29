/**
 * Scamazon - Customer Storefront & Cart Portal Logic
 */
let activeStorefronts = [];
        let allListings = [];
        let cart = [];
        let trackedOrderCache = null;
        let lastPlacedOrderNumber = '';
        let lastPlacedOrderCount = 1;
        let currentCustomerId = '';
        let currentCustomerEmail = '';
        let customerOrderHistory = [];

        

        function getCustomerOrdersStorageKey() {
            if (!currentCustomerEmail && !currentCustomerId) return null;
            const identifier = (currentCustomerEmail || currentCustomerId).toLowerCase();
            return `scamazon_customer_orders_${identifier}`;
        }

        function storeCustomerOrderReference(orderObj) {
            const key = getCustomerOrdersStorageKey();
            if (!key || !orderObj || !orderObj.order_number) return;
            try {
                const saved = localStorage.getItem(key);
                let list = saved ? JSON.parse(saved) : [];
                // Prepend latest order, deduping by order_number
                list = list.filter(o => o.order_number !== orderObj.order_number);
                list.unshift(orderObj);
                list = consolidateCustomerOrders(list);
                // Entire order history is preserved (no slicing or truncation)
                localStorage.setItem(key, JSON.stringify(list));
                customerOrderHistory = list;
            } catch (err) {
                console.error('Failed to save customer order reference:', err);
            }
        }

        function consolidateCustomerOrders(rawOrders) {
            if (!Array.isArray(rawOrders) || rawOrders.length === 0) return [];
            const consolidated = [];
            let i = 0;
            while (i < rawOrders.length) {
                const curr = { ...rawOrders[i] };
                if (!Array.isArray(curr.sub_order_numbers)) {
                    curr.sub_order_numbers = [curr.order_number];
                }

                let j = i + 1;
                while (j < rawOrders.length) {
                    const nxt = rawOrders[j];
                    let diffSeconds = 999999;
                    try {
                        const t1 = new Date(curr.created_at).getTime();
                        const t2 = new Date(nxt.created_at).getTime();
                        diffSeconds = Math.abs((t1 - t2) / 1000);
                    } catch (e) {}

                    // Merge adjacent split orders created within 6s of each other during multi-storefront checkout
                    if (diffSeconds <= 6 && nxt.order_number !== curr.order_number) {
                        if (!curr.sub_order_numbers.includes(nxt.order_number)) {
                            curr.sub_order_numbers.push(nxt.order_number);
                        }
                        if (Array.isArray(nxt.sub_order_numbers)) {
                            nxt.sub_order_numbers.forEach(s => {
                                if (s && !curr.sub_order_numbers.includes(s)) curr.sub_order_numbers.push(s);
                            });
                        }
                        const sfs = (curr.storefront || '').split(',')
                            .concat((nxt.storefront || '').split(','))
                            .map(s => s.trim())
                            .filter(Boolean);
                        curr.storefront = Array.from(new Set(sfs)).join(', ');

                        const currItems = curr.items || '';
                        const nxtItems = nxt.items || '';
                        curr.items = currItems && nxtItems ? `${currItems}\n${nxtItems}` : (currItems || nxtItems);

                        const totalA = parseFloat(String(curr.total || '0').replace('$', '')) || 0;
                        const totalB = parseFloat(String(nxt.total || '0').replace('$', '')) || 0;
                        curr.total = (totalA + totalB).toFixed(2);
                        j++;
                    } else {
                        break;
                    }
                }
                consolidated.push(curr);
                i = j;
            }
            return consolidated;
        }

        function getCatalogFilterKey() {
            if (!currentCustomerId) return null;
            return `scamazon_catalog_filters_${currentCustomerId}`;
        }

        function saveCatalogFilters() {
            const key = getCatalogFilterKey();
            if (!key) return;

            sessionStorage.setItem(key, JSON.stringify({
                storefront: document.getElementById('catalog-storefront').value,
                search: document.getElementById('catalog-search').value
            }));
        }

        function restoreCatalogFilters() {
            const key = getCatalogFilterKey();
            if (!key) return;

            try {
                const saved = JSON.parse(sessionStorage.getItem(key) || '{}');

                const dropdown = document.getElementById('catalog-storefront');

                if (
                    typeof saved.storefront === 'string' &&
                    Array.from(dropdown.options).some(
                        option => option.value === saved.storefront
                    )
                ) {
                    dropdown.value = saved.storefront;
                }

                if (typeof saved.search === 'string') {
                    document.getElementById('catalog-search').value = saved.search;
                }
            } catch (error) {
                console.error('Could not restore catalog filters:', error);
                sessionStorage.removeItem(key);
            }
        }

        function getCartStorageKey() {
            if (!currentCustomerId) return null;
            return `scamazon_proto1_cart_${currentCustomerId}`;
        }

        function saveCart() {
            const key = getCartStorageKey();
            if (!key) return;

            const savedCart = cart.map(item => ({
                id: item.id,
                qty: item.qty
            }));

            localStorage.setItem(key, JSON.stringify(savedCart));
        }

        function restoreCart() {
            const key = getCartStorageKey();
            if (!key) return;

            try {
                const savedCart = JSON.parse(localStorage.getItem(key) || '[]');

                cart = savedCart
                    .map(savedItem => {
                        const listing = allListings.find(
                            item => item.id === savedItem.id
                        );

                        if (!listing || listing.stock <= 0) {
                            return null;
                        }

                        const qty = Math.min(
                            Math.max(parseInt(savedItem.qty, 10) || 1, 1),
                            listing.stock
                        );

                        return {
                            ...listing,
                            qty
                        };
                    })
                    .filter(Boolean);

            } catch (err) {
                console.error('Could not restore cart:', err);
                cart = [];
                localStorage.removeItem(key);
            }

            updateCartUI();
        }

        function clearSavedCart() {
            const key = getCartStorageKey();

            if (key) {
                localStorage.removeItem(key);
            }
        }

        async function checkSession() {
            const { data: { session } } = await client.auth.getSession();
            if (!session) {
                window.location.href = 'login';
                return;
            }

            const { data: userRecord } = await client
                .from('users')
                .select('role, email')
                .eq('email', session.user.email)
                .maybeSingle();

            const role = userRecord?.role || session.user?.user_metadata?.role || 'customer';

            if (role === 'worker') {
                window.location.replace('worker');
                return;
            }

            if (role === 'storefront_owner') {
                window.location.replace('storefront');
                return;
            }

            if (role === 'owner') {
                window.location.replace('owner');
                return;
            }

            if (role !== 'customer') {
                await client.auth.signOut();
                window.location.replace('login?unauthorized=1');
                return;
            }

           document.getElementById('user-display').textContent = session.user.email;

            currentCustomerId = session.user.id;
            currentCustomerEmail = session.user.email;

            await loadInitialData();
            restoreCart();
            await loadCustomerOrderHistory();
            initCustomerRealtime();
        }

        async function loadInitialData() {
            await Promise.all([fetchStorefronts(), fetchListings()]);
            populateStorefrontDropdown();
            restoreCatalogFilters();
            renderCatalog();
            updateListingsCountBadge();
        }

        function switchTab(tab) {
            const tabs = {
                catalog: document.getElementById('tab-catalog'),
                tracking: document.getElementById('tab-tracking')
            };

            const navs = {
                catalog: document.getElementById('nav-catalog'),
                tracking: document.getElementById('nav-tracking')
            };

            const headings = {
                catalog: 'Storefronts & Listings',
                tracking: 'Track Orders & Invoices'
            };

            Object.values(tabs).forEach(el => {
                el.classList.add('hidden');
                el.setAttribute('hidden', '');
            });
            Object.values(navs).forEach(el => {
                el.className = 'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between hover:bg-slate-100 text-slate-600 hover:text-slate-900';
            });

            tabs[tab].classList.remove('hidden');
            tabs[tab].removeAttribute('hidden');
            navs[tab].className = 'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between bg-slate-900 text-white shadow-sm shadow-slate-900/10';
            document.getElementById('page-heading').textContent = headings[tab];

            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTop = 0;

            const listingsBadge = document.getElementById('listings-badge');
            if (listingsBadge) {
                if (tab === 'catalog') {
                    listingsBadge.className = 'text-xs bg-slate-800 text-slate-200 px-2 py-0.5 rounded-md tabular-nums font-medium';
                } else {
                    listingsBadge.className = 'text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md tabular-nums font-medium border border-slate-200';
                }
            }

            if (tab === 'tracking') {
                loadCustomerOrderHistory();
                startTrackingPoll();
            } else {
                stopTrackingPoll();
            }
        }

        function updateListingsCountBadge() {
            const badge = document.getElementById('listings-badge');
            if (badge) {
                badge.textContent = allListings ? allListings.length : 0;
            }
        }

        // ================= STOREFRONTS & LISTINGS =================
        async function fetchStorefronts() {
            const { data } = await client.from('storefronts').select('*').eq('status', 'Active');
            activeStorefronts = data || [];
        }

        async function fetchListings() {
            const { data, error } = await client
                .from('listings')
                .select('*')
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });

            if (error) {
                console.error('Failed to load listings:', error);
                return;
            }

            allListings = data || [];
            updateListingsCountBadge();
        }

        function populateStorefrontDropdown() {
            const select = document.getElementById('catalog-storefront');
            const previousValue = select.value;

            select.innerHTML = `<option value="">All Storefronts</option>` +
                activeStorefronts.map(s =>
                    `<option value="${s.name}">${s.name}</option>`
                ).join('');

            const storefrontStillExists = [...select.options].some(
                option => option.value === previousValue
            );

            select.value = storefrontStillExists ? previousValue : "";
        }

        function renderCatalog() {
            const container = document.getElementById('catalog-grid');
            const selectedBranch = document.getElementById('catalog-storefront').value;
            const searchTerm = document.getElementById('catalog-search').value.toLowerCase().trim();

            const branchItems = allListings.filter(l => {
                const matchesBranch = !selectedBranch || l.storefront === selectedBranch;
                const matchesSearch = l.title.toLowerCase().includes(searchTerm) || l.sku.toLowerCase().includes(searchTerm);
                return matchesBranch && matchesSearch;
            });

            if (branchItems.length === 0) {
                container.innerHTML = `<p class="text-sm text-slate-400 col-span-full py-12 text-center">No listings available matching your selection.</p>`;
                return;
            }

            container.innerHTML = branchItems.map(item => {
                const isOutOfStock = item.stock <= 0;
                const img = item.image_url
                    ? `<img src="${item.image_url}" class="w-full h-48 object-contain bg-white rounded-lg mb-3 border border-slate-200">`
                    : `<div class="w-full h-48 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 font-mono text-xs border border-slate-200">No Image</div>`;

                return `
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            ${img}
                            <div class="flex justify-between items-start gap-2">
                                <div>
                                    <h3 class="font-bold text-slate-900 text-sm tracking-tight">${item.title}</h3>
                                    <p class="text-xs font-mono text-slate-400">${item.sku}</p>
                                    <span class="inline-block mt-1.5 text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">${item.storefront}</span>
                                </div>
                                <span class="text-sm font-bold text-slate-900">$${parseFloat(item.price).toFixed(2)}</span>
                            </div>
                            <p class="text-xs mt-3 ${isOutOfStock ? 'text-rose-600 font-semibold' : 'text-slate-500'}">
                                ${isOutOfStock ? 'Out of Stock' : item.stock + ' units available'}
                            </p>
                        </div>
                        <button onclick="addToCart('${item.id}')" ${isOutOfStock ? 'disabled' : ''} 
                            class="mt-4 w-full inline-flex items-center justify-center py-2 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 hover:-translate-y-0.5 shadow-sm shadow-slate-900/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
                            ${isOutOfStock ? 'Unavailable' : 'Add to Cart'}
                        </button>
                    </div>
                `;
            }).join('');
        }

        function addToCart(listingId) {
            const item = allListings.find(l => l.id === listingId);
            if (!item || item.stock <= 0) return;

            const existing = cart.find(c => c.id === listingId);
            if (existing) {
                if (existing.qty < item.stock) {
                    existing.qty += 1;
                } else {
                    alert('Cannot add more units than are physically in stock.');
                }
            } else {
                cart.push({ ...item, qty: 1 });
            }

            updateCartUI();
            saveCart();
        }

        function updateCartUI() {
            const count = cart.reduce((sum, i) => sum + i.qty, 0);
            document.getElementById('cart-counter').textContent = count;

            const selectedBranch = document.getElementById('catalog-storefront').value;
            const cartSfEl = document.getElementById('cart-storefront-name'); if (cartSfEl) cartSfEl.textContent = selectedBranch || (cart.length > 0 ? cart[0].storefront : 'All Storefronts');

            const container = document.getElementById('cart-items-container');
            const totalEl = document.getElementById('cart-total-price');
            const orderBtn = document.getElementById('order-btn');

            if (cart.length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-400 text-center py-10">Cart is empty.</p>`;
                totalEl.textContent = '$0.00';
                orderBtn.disabled = true;
                return;
            }

            let total = 0;
            container.innerHTML = cart.map(item => {
                const sub = item.qty * item.price;
                total += sub;
                return `
                    <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div>
                            <p class="font-semibold text-slate-900">${item.title}</p>
                            <p class="text-slate-400 font-mono">${item.sku} &bull; $${item.price} each</p>
                            <p class="text-[10px] text-slate-500 font-medium">${item.storefront}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-mono font-bold text-slate-900">Qty: ${item.qty}</span>
                            <button onclick="removeFromCart('${item.id}')" class="text-rose-600 hover:text-rose-800 ml-2 font-bold text-sm">&times;</button>
                        </div>
                    </div>
                `;
            }).join('');

            totalEl.textContent = `$${total.toFixed(2)}`;
            orderBtn.disabled = false;
        }

        function removeFromCart(id) {
            cart = cart.filter(c => c.id !== id);
            updateCartUI();
            saveCart();
        }

        function toggleCartDrawer() {
            document.getElementById('cart-drawer').classList.toggle('hidden');
        }

        async function placeOrder() {
            if (cart.length === 0) return;

            const orderBtn = document.getElementById('order-btn');
            orderBtn.disabled = true;
            orderBtn.textContent = 'Processing Order...';

            try {
                // Group cart items by their storefront.
                // Each storefront receives its own verified order.
                const storefrontGroups = {};
                cart.forEach(item => {
                    const sf = item.storefront || (allListings.find(l => l.id === item.id)?.storefront) || 'Storefront Depot';
                    if (!storefrontGroups[sf]) {
                        storefrontGroups[sf] = [];
                    }
                    storefrontGroups[sf].push(item);
                });

                const placedOrders = [];
                let grandTotal = 0;

                for (const [storefrontName, groupItems] of Object.entries(storefrontGroups)) {
                    const secureItems = groupItems.map(item => ({
                        id: item.id,
                        qty: parseInt(item.qty, 10)
                    }));

                    const { data, error } = await client.rpc('place_order', {
                        p_items: secureItems,
                        p_coupon_code: null
                    });

                    if (error) {
                        throw error;
                    }

                    const result = typeof data === 'string' ? JSON.parse(data) : data;
                    const orderNum = result?.order_number || `Order #${Math.floor(1000 + Math.random() * 9000)}`;
                    const groupTotal = result?.total
                        ? parseFloat(result.total)
                        : groupItems.reduce((sum, i) => sum + (i.qty * i.price), 0);

                    grandTotal += groupTotal;

                    placedOrders.push({
                        order_number: orderNum,
                        storefront: storefrontName,
                        total: groupTotal
                    });
                }

                if (placedOrders.length === 0) {
                    throw new Error('No orders were placed.');
                }

                // UNIFY INTO ONE ORDER NO MATTER WHAT:
                const masterOrderNumber = placedOrders[0].order_number;
                const storefrontNames = Object.keys(storefrontGroups);
                const combinedStorefront = storefrontNames.length === 1
                    ? storefrontNames[0]
                    : storefrontNames.join(', ');

                // Build clean line-by-line items string for all items ordered
                const allItemsString = cart.map(i => `${i.qty}x ${i.title} (${i.sku})`).join('\n');

                const masterOrder = {
                    order_number: masterOrderNumber,
                    sub_order_numbers: placedOrders.map(o => o.order_number),
                    storefront: combinedStorefront,
                    items: allItemsString,
                    total: grandTotal.toFixed(2),
                    created_at: new Date().toISOString(),
                    status: 'Processing'
                };

                storeCustomerOrderReference(masterOrder);

                lastPlacedOrderCount = 1;
                lastPlacedOrderNumber = masterOrderNumber;

                const totalFormatted = '$' + grandTotal.toFixed(2);
                document.getElementById('confirmation-message').textContent =
                    `${masterOrderNumber} confirmed. Total: ${totalFormatted}. Processing for shipping & delivery.`;
                document.getElementById('confirmation-modal').classList.remove('hidden');

                cart = [];
                clearSavedCart();
                updateCartUI();
                toggleCartDrawer();
                await fetchListings();
                renderCatalog();
                renderCustomerOrderHistory();
            } catch (err) {
                console.error('Order placement error:', err);
                alert('Failed to place order: ' + err.message);
            } finally {
                orderBtn.disabled = false;
                orderBtn.textContent = 'Place Order';
            }
        }

        function closeConfirmationModal() {
            document.getElementById('confirmation-modal').classList.add('hidden');
        }

        function trackPlacedOrder() {
            closeConfirmationModal();
            switchTab('tracking');
            const searchInput = document.getElementById('order-search-input');
            if (searchInput && lastPlacedOrderNumber) {
                searchInput.value = lastPlacedOrderNumber;
                handleOrderSearchInput(lastPlacedOrderNumber);
            }
        }

        function resolveCompositeOrderStatus(order, liveMap) {
            const numbers = Array.isArray(order.sub_order_numbers) && order.sub_order_numbers.length > 0
                ? order.sub_order_numbers
                : [order.order_number];

            const ranks = {
                'Processing': 1,
                'Ready for Driver': 2,
                'Shipped': 2,
                'Out for Delivery': 3,
                'Delivered': 4
            };
            const rankToStatus = {
                1: 'Processing',
                2: 'Shipped',
                3: 'Out for Delivery',
                4: 'Delivered'
            };

            let minRank = null;
            numbers.forEach(num => {
                const live = liveMap.get(num);
                if (live && live.status) {
                    const r = ranks[live.status] || 1;
                    if (minRank === null || r < minRank) {
                        minRank = r;
                    }
                }
            });

            if (minRank !== null) {
                return rankToStatus[minRank];
            }
            return order.status || 'Processing';
        }

        /* --- REGISTERED CUSTOMER ORDER HISTORY (ENTIRE HISTORY) --- */
        async function loadCustomerOrderHistory() {
            const listContainer = document.getElementById('order-history-list');
            const countBadge = document.getElementById('history-count-badge');
            if (!listContainer) return;

            const key = getCustomerOrdersStorageKey();
            let storedOrders = [];
            if (key) {
                try {
                    const saved = localStorage.getItem(key);
                    if (saved) storedOrders = JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse customer orders from storage:', e);
                }
            }

            storedOrders = consolidateCustomerOrders(storedOrders);
            if (key) {
                try {
                    localStorage.setItem(key, JSON.stringify(storedOrders));
                } catch (e) {}
            }

            customerOrderHistory = storedOrders || [];

            if (countBadge) {
                countBadge.textContent = customerOrderHistory ? customerOrderHistory.length : 0;
            }

            if (!customerOrderHistory || customerOrderHistory.length === 0) {
                renderCustomerOrderHistory();
                return;
            }

            // Sync with live Supabase orders table across all master and sub-orders
            try {
                const allQueryNumbers = [];
                customerOrderHistory.forEach(o => {
                    if (o.order_number && !allQueryNumbers.includes(o.order_number)) {
                        allQueryNumbers.push(o.order_number);
                    }
                    if (Array.isArray(o.sub_order_numbers)) {
                        o.sub_order_numbers.forEach(sub => {
                            if (sub && !allQueryNumbers.includes(sub)) {
                                allQueryNumbers.push(sub);
                            }
                        });
                    }
                });

                if (allQueryNumbers.length > 0) {
                    const { data: liveOrders, error } = await client
                        .from('orders')
                        .select('*')
                        .in('order_number', allQueryNumbers);

                    if (!error && liveOrders) {
                        const liveMap = new Map(liveOrders.map(o => [o.order_number, o]));
                        customerOrderHistory = customerOrderHistory.map(order => {
                            const newStatus = resolveCompositeOrderStatus(order, liveMap);
                            return {
                                ...order,
                                status: newStatus
                            };
                        });

                        if (key) {
                            localStorage.setItem(key, JSON.stringify(customerOrderHistory));
                        }
                    }
                }
            } catch (syncErr) {
                console.warn('Live order status sync skipped:', syncErr);
            }

            filterCustomerOrderHistory();
        }
        window.loadCustomerOrderHistory = loadCustomerOrderHistory;

        /* --- REALTIME ORDER TRACKING & AUTO-SYNC --- */
        let orderRealtimeChannel = null;
        let trackingPollTimer = null;

        function initCustomerRealtime() {
            if (orderRealtimeChannel) return;
            try {
                orderRealtimeChannel = client
                    .channel('customer-orders-live-tracking')
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'orders' },
                        (payload) => {
                            handleLiveOrderUpdate(payload);
                        }
                    )
                    .subscribe((status, err) => {
                        if (err) {
                            console.warn('Realtime order subscription status:', status, err);
                        }
                    });
            } catch (err) {
                console.warn('Failed to initialize Supabase Realtime channel:', err);
            }
        }
        window.initCustomerRealtime = initCustomerRealtime;

        function handleLiveOrderUpdate(payload) {
            if (!payload || !payload.new) return;
            const updated = payload.new;
            if (!updated.order_number) return;

            const isRelevant = customerOrderHistory.some(o => 
                o.order_number === updated.order_number ||
                (Array.isArray(o.sub_order_numbers) && o.sub_order_numbers.includes(updated.order_number))
            );

            if (isRelevant) {
                syncLiveOrdersQuietly();
            }
        }

        function startTrackingPoll() {
            stopTrackingPoll();
            // Continuous smart fallback sync while customer is on the tracking tab
            trackingPollTimer = setInterval(() => {
                syncLiveOrdersQuietly();
            }, 3000);
        }
        window.startTrackingPoll = startTrackingPoll;

        function stopTrackingPoll() {
            if (trackingPollTimer) {
                clearInterval(trackingPollTimer);
                trackingPollTimer = null;
            }
        }
        window.stopTrackingPoll = stopTrackingPoll;

        async function syncLiveOrdersQuietly() {
            if (!customerOrderHistory || customerOrderHistory.length === 0) return;
            try {
                const allQueryNumbers = [];
                customerOrderHistory.forEach(o => {
                    if (o.order_number && !allQueryNumbers.includes(o.order_number)) {
                        allQueryNumbers.push(o.order_number);
                    }
                    if (Array.isArray(o.sub_order_numbers)) {
                        o.sub_order_numbers.forEach(sub => {
                            if (sub && !allQueryNumbers.includes(sub)) {
                                allQueryNumbers.push(sub);
                            }
                        });
                    }
                });

                if (allQueryNumbers.length === 0) return;

                const { data: liveOrders, error } = await client
                    .from('orders')
                    .select('*')
                    .in('order_number', allQueryNumbers);

                if (!error && liveOrders) {
                    const liveMap = new Map(liveOrders.map(o => [o.order_number, o]));
                    let changed = false;

                    customerOrderHistory = customerOrderHistory.map(order => {
                        const newStatus = resolveCompositeOrderStatus(order, liveMap);
                        if (newStatus !== order.status) {
                            changed = true;
                        }
                        return {
                            ...order,
                            status: newStatus
                        };
                    });

                    if (changed) {
                        const key = getCustomerOrdersStorageKey();
                        if (key) {
                            try {
                                localStorage.setItem(key, JSON.stringify(customerOrderHistory));
                            } catch (e) {}
                        }
                        filterCustomerOrderHistory();
                    }
                }
            } catch (err) {
                console.warn('Quiet live order sync warning:', err);
            }
        }
        window.syncLiveOrdersQuietly = syncLiveOrdersQuietly;

        let remoteSearchDebounceTimer = null;

        function handleOrderSearchInput(val) {
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn) {
                if (val && val.trim().length > 0) {
                    clearBtn.classList.remove('hidden');
                } else {
                    clearBtn.classList.add('hidden');
                }
            }

            const matchedCount = filterCustomerOrderHistory();

            const trimmed = (val || '').trim();
            const cleanPattern = trimmed.replace(/^order\s*#?\s*/i, '').replace(/[#%_]/g, '').trim();

            if (remoteSearchDebounceTimer) {
                clearTimeout(remoteSearchDebounceTimer);
            }

            const hintEl = document.getElementById('search-status-hint');

            if (matchedCount === 0 && cleanPattern.length >= 2) {
                if (hintEl) hintEl.textContent = 'Searching database...';
                remoteSearchDebounceTimer = setTimeout(async () => {
                    try {
                        const { data, error } = await client
                            .from('orders')
                            .select('*')
                            .ilike('order_number', `%${cleanPattern}%`)
                            .limit(5);

                        if (!error && data && data.length > 0) {
                            data.forEach(ord => {
                                storeCustomerOrderReference({
                                    order_number: ord.order_number,
                                    storefront: ord.storefront,
                                    items: ord.items,
                                    total: ord.total || '',
                                    created_at: ord.created_at,
                                    status: ord.status || 'Processing'
                                });
                            });
                            filterCustomerOrderHistory();
                            if (hintEl) hintEl.textContent = `Found ${data.length} remote order${data.length === 1 ? '' : 's'}`;
                        } else {
                            if (hintEl) hintEl.textContent = 'No matching order found';
                        }
                    } catch (err) {
                        console.warn('Remote search error:', err);
                        if (hintEl) hintEl.textContent = 'Realtime filtering active';
                    }
                }, 300);
            } else {
                if (hintEl) {
                    hintEl.textContent = trimmed ? `${matchedCount} result${matchedCount === 1 ? '' : 's'}` : 'Realtime filtering active';
                }
            }
        }
        window.handleOrderSearchInput = handleOrderSearchInput;

        function clearOrderSearch() {
            const input = document.getElementById('order-search-input');
            if (input) {
                input.value = '';
                handleOrderSearchInput('');
                input.focus();
            }
        }
        window.clearOrderSearch = clearOrderSearch;

        function filterCustomerOrderHistory() {
            const searchRaw = (document.getElementById('order-search-input')?.value || '').toLowerCase().trim();
            const statusFilter = document.getElementById('history-status-filter')?.value || '';

            const cleanSearchNum = searchRaw.replace(/^order\s*#?\s*/i, '').replace(/[#%_]/g, '').trim();

            const filteredOrders = customerOrderHistory.filter(order => {
                const orderNum = (order.order_number || '').toLowerCase();
                const itemsStr = (order.items || '').toLowerCase();
                const storefront = (order.storefront || '').toLowerCase();
                const currentStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');

                // Search by order ID (full string, digits, or substring)
                const matchesOrderNum = searchRaw && (
                    orderNum.includes(searchRaw) ||
                    (cleanSearchNum && orderNum.replace(/[#\s]/g, '').includes(cleanSearchNum)) ||
                    (Array.isArray(order.sub_order_numbers) && order.sub_order_numbers.some(sub => {
                        const s = (sub || '').toLowerCase();
                        return s.includes(searchRaw) || (cleanSearchNum && s.replace(/[#\s]/g, '').includes(cleanSearchNum));
                    }))
                );

                // Search by items in the order
                const matchesItems = searchRaw && itemsStr.includes(searchRaw);

                // Search by storefront depot
                const matchesStorefront = searchRaw && storefront.includes(searchRaw);

                const matchesSearch = !searchRaw || matchesOrderNum || matchesItems || matchesStorefront;
                const matchesStatus = !statusFilter || order.status === statusFilter || currentStatus === statusFilter;

                return matchesSearch && matchesStatus;
            });

            renderCustomerOrderHistory(filteredOrders);
            return filteredOrders.length;
        }
        window.filterCustomerOrderHistory = filterCustomerOrderHistory;

        function resetHistoryFilters() {
            const searchInput = document.getElementById('order-search-input');
            const statusFilter = document.getElementById('history-status-filter');
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = '';
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn) clearBtn.classList.add('hidden');
            const hintEl = document.getElementById('search-status-hint');
            if (hintEl) hintEl.textContent = 'Realtime filtering active';
            renderCustomerOrderHistory(customerOrderHistory);
        }
        window.resetHistoryFilters = resetHistoryFilters;

        function renderCustomerOrderHistory(ordersToRender) {
            const listContainer = document.getElementById('order-history-list');
            const countBadge = document.getElementById('history-count-badge');
            if (!listContainer) return;

            const orders = ordersToRender !== undefined ? ordersToRender : customerOrderHistory;

            if (countBadge) {
                if (!customerOrderHistory || customerOrderHistory.length === 0) {
                    countBadge.textContent = '0';
                } else if (orders.length === customerOrderHistory.length) {
                    countBadge.textContent = customerOrderHistory.length;
                } else {
                    countBadge.textContent = `${orders.length}/${customerOrderHistory.length}`;
                }
            }

            if (!customerOrderHistory || customerOrderHistory.length === 0) {
                listContainer.innerHTML = `
                    <div class="p-8 text-center rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <p class="text-sm font-bold text-slate-900">No Placed Orders Found Yet</p>
                        <p class="text-xs text-slate-500 max-w-sm mx-auto">
                            You haven't placed any delivery orders under <span class="text-slate-700 font-semibold">${sanitizeHtml(currentCustomerEmail || 'your account')}</span>. Browse our catalog to get started!
                        </p>
                        <button onclick="switchTab('catalog')" class="mt-2 inline-flex items-center px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800 transition-colors">
                            Explore Catalog
                        </button>
                    </div>
                `;
                return;
            }

            if (orders.length === 0) {
                listContainer.innerHTML = `
                    <div class="p-6 text-center rounded-xl bg-white border border-slate-200 shadow-sm space-y-2">
                        <p class="text-sm font-semibold text-slate-900">No matching orders found</p>
                        <p class="text-xs text-slate-500">Try adjusting your search terms or status filter.</p>
                        <button onclick="resetHistoryFilters()" class="mt-1 inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">Reset Filters</button>
                    </div>
                `;
                return;
            }

            // Render all orders with inline 4-stage fulfillment timeline
            listContainer.innerHTML = orders.map(order => {
                const currentStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');
                
                let statusBadge = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Processing
                    </span>
                `;

                if (['Shipped', 'Ready for Driver'].includes(order.status)) {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                            Shipped
                        </span>
                    `;
                } else if (order.status === 'Out for Delivery') {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            Out for Delivery
                        </span>
                    `;
                } else if (order.status === 'Delivered') {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Delivered
                        </span>
                    `;
                }

                const placedDate = order.created_at
                    ? new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recent';

                const totalFormatted = order.total
                    ? (order.total.toString().startsWith('$') ? sanitizeHtml(order.total) : '$' + Number(order.total).toFixed(2))
                    : '';

                // Calculate timeline progression
                let step = 1;
                let progressWidth = '0%';
                if (order.status === 'Delivered') {
                    step = 4;
                    progressWidth = '100%';
                } else if (order.status === 'Out for Delivery') {
                    step = 3;
                    progressWidth = '66.6%';
                } else if (['Shipped', 'Ready for Driver'].includes(order.status)) {
                    step = 2;
                    progressWidth = '33.3%';
                } else {
                    step = 1;
                    progressWidth = '0%';
                }

                const getStepStyles = (stepIdx) => {
                    const isCompleted = step > stepIdx;
                    const isCurrent = step === stepIdx;
                    
                    let dotClass = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all';
                    let labelClass = 'text-xs mt-1.5 font-medium transition-colors';
                    let subClass = 'text-[11px] font-medium transition-colors';

                    if (isCurrent) {
                        dotClass += ' bg-amber-500 text-slate-950 ring-2 ring-amber-300 ring-offset-2 ring-offset-white';
                        labelClass = 'text-xs mt-1.5 font-bold text-slate-900';
                        subClass = 'text-[11px] font-semibold text-amber-700';
                    } else if (isCompleted) {
                        dotClass += ' bg-amber-500 text-slate-950';
                        labelClass = 'text-xs mt-1.5 font-semibold text-slate-800';
                        subClass = 'text-[11px] font-medium text-slate-500';
                    } else {
                        dotClass += ' bg-white border border-slate-300 text-slate-400';
                        labelClass = 'text-xs mt-1.5 font-medium text-slate-400';
                        subClass = 'text-[11px] font-medium text-slate-400';
                    }
                    return { dotClass, labelClass, subClass, isCompleted, isCurrent };
                };

                const s1 = getStepStyles(1);
                const s2 = getStepStyles(2);
                const s3 = getStepStyles(3);
                const s4 = getStepStyles(4);

                const createdAtDate = order.created_at ? new Date(order.created_at) : new Date();
                let estDeliveryText = '';
                if (step === 4) {
                    estDeliveryText = 'Delivered';
                } else if (step === 3) {
                    estDeliveryText = 'Arriving today by 8:00 PM';
                } else if (step === 2) {
                    const est = new Date(createdAtDate.getTime() + 24 * 60 * 60 * 1000);
                    estDeliveryText = `Est. delivery: ${est.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                } else {
                    const est = new Date(createdAtDate.getTime() + 48 * 60 * 60 * 1000);
                    estDeliveryText = `Est. delivery: ${est.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                }

                const rawItemsClean = (order.items || '-').replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();
                const displayItems = sanitizeHtml(rawItemsClean).replace(/\n/g, ', ');
                const storefrontLabel = order.storefront && order.storefront.includes(',') ? 'Storefronts' : 'Storefront';

                return `
                    <article class="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all space-y-4">
                        <!-- Top Order Header -->
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-base text-slate-900">${sanitizeHtml(order.order_number)}</span>
                                    ${statusBadge}
                                </div>
                                <p class="text-xs text-slate-500 mt-1">
                                    Placed on <span class="font-medium text-slate-700">${placedDate}</span> &bull; ${storefrontLabel}: <span class="font-medium text-slate-700">${sanitizeHtml(order.storefront || 'Storefront Depot')}</span>
                                </p>
                            </div>
                            <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                <button type="button" onclick="viewHistoryOrderReceipt('${sanitizeHtml(order.order_number)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:border-slate-900 hover:text-slate-900 text-slate-700 font-semibold text-xs rounded-lg transition-colors focus:outline-none">
                                    <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                    <span>View Receipt</span>
                                </button>
                            </div>
                        </div>

                        <!-- Purchased Items & Total -->
                        <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                            <div class="space-y-0.5 flex-1 pr-2">
                                <span class="text-xs font-medium text-slate-500 block">Purchased items</span>
                                <p class="text-xs text-slate-800 line-clamp-1">${displayItems}</p>
                            </div>
                            ${totalFormatted ? `
                                <div class="text-left sm:text-right shrink-0">
                                    <span class="text-xs font-medium text-slate-500 block">Order total</span>
                                    <span class="font-bold text-sm text-slate-900 tabular-nums">${totalFormatted}</span>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Embedded Fulfillment Timeline Underneath Order -->
                        <div class="pt-2 border-t border-slate-100">
                            <div class="flex items-center justify-between text-xs mb-3">
                                <h4 class="font-semibold text-slate-900">Fulfillment Timeline</h4>
                                <span class="text-slate-500 font-medium">${estDeliveryText}</span>
                            </div>

                            <div class="relative py-1">
                                <!-- Background connecting bar between milestone centers (12.5% to 87.5%) -->
                                <div class="absolute left-[12.5%] right-[12.5%] top-4 h-1 bg-slate-100 rounded-full">
                                    <div class="h-full bg-amber-500 rounded-full transition-all duration-300" style="width: ${progressWidth};"></div>
                                </div>

                                <!-- 4 Milestone Nodes -->
                                <div class="relative z-10 grid grid-cols-4 gap-1 text-center">
                                    <!-- Step 1: Processing -->
                                    <div class="flex flex-col items-center">
                                        <div class="${s1.dotClass}" title="Processing">
                                            ${s1.isCompleted ? `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                            ` : `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                            `}
                                        </div>
                                        <span class="${s1.labelClass}">Processing</span>
                                        <span class="${s1.subClass}">${s1.isCompleted ? 'Placed' : (s1.isCurrent ? 'Queue' : 'Pending')}</span>
                                    </div>

                                    <!-- Step 2: Shipped -->
                                    <div class="flex flex-col items-center">
                                        <div class="${s2.dotClass}" title="Shipped">
                                            ${s2.isCompleted ? `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                            ` : `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                                            `}
                                        </div>
                                        <span class="${s2.labelClass}">Shipped</span>
                                        <span class="${s2.subClass}">${s2.isCompleted ? 'Shipped' : (s2.isCurrent ? 'In Transit' : 'Pending')}</span>
                                    </div>

                                    <!-- Step 3: Out for Delivery -->
                                    <div class="flex flex-col items-center">
                                        <div class="${s3.dotClass}" title="Out for Delivery">
                                            ${s3.isCompleted ? `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                            ` : `
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
                                            `}
                                        </div>
                                        <span class="${s3.labelClass}">Out for Delivery</span>
                                        <span class="${s3.subClass}">${s3.isCompleted ? 'En Route' : (s3.isCurrent ? 'Courier Out' : 'Pending')}</span>
                                    </div>

                                    <!-- Step 4: Delivered -->
                                    <div class="flex flex-col items-center">
                                        <div class="${s4.dotClass}" title="Delivered">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                        </div>
                                        <span class="${s4.labelClass}">Delivered</span>
                                        <span class="${s4.subClass}">${s4.isCurrent ? 'Arrived' : 'Pending'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        }
        window.renderCustomerOrderHistory = renderCustomerOrderHistory;

        function viewHistoryOrderReceipt(orderNumber) {
            const order = customerOrderHistory.find(o => o.order_number === orderNumber);
            if (!order) return;
            trackedOrderCache = order;
            openReceiptModal();
        }
        window.viewHistoryOrderReceipt = viewHistoryOrderReceipt;

        function trackOrder(orderNumber) {
            const target = orderNumber || document.getElementById('order-search-input')?.value;
            if (target) {
                const searchInput = document.getElementById('order-search-input');
                if (searchInput) {
                    searchInput.value = target;
                    handleOrderSearchInput(target);
                }
            }
        }
        window.trackOrder = trackOrder;

        function openReceiptModal() {
            if (!trackedOrderCache) return;

            document.getElementById('receipt-order-id').textContent = trackedOrderCache.order_number;
            const branchNameEl = document.getElementById('receipt-branch-name');
            if (branchNameEl) branchNameEl.textContent = trackedOrderCache.storefront || 'Storefront Depot';

            const itemsListEl = document.getElementById('receipt-items-list');
            if (itemsListEl) {
                const rawItems = (trackedOrderCache.items || '').replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();
                if (!rawItems) {
                    itemsListEl.innerHTML = '<div class="py-1 text-xs text-slate-400">No items recorded</div>';
                } else {
                    let itemsArr = [];
                    if (rawItems.includes('\n')) {
                        itemsArr = rawItems.split('\n');
                    } else if (/,\s*(?=\d+\s*x\b)/i.test(rawItems)) {
                        itemsArr = rawItems.split(/,\s*(?=\d+\s*x\b)/i);
                    } else {
                        itemsArr = rawItems.split(/,\s*/);
                    }

                    itemsListEl.innerHTML = itemsArr
                        .map(i => i.trim())
                        .filter(Boolean)
                        .map(item => `
                            <div class="py-1 text-xs text-slate-800 font-medium">
                                ${sanitizeHtml(item)}
                            </div>
                        `).join('');
                }
            }

            const rd = trackedOrderCache.created_at ? new Date(trackedOrderCache.created_at) : new Date();
            const rDateStr = rd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const rTimeStr = rd.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const receiptDateEl = document.getElementById('receipt-date');
            if (receiptDateEl) receiptDateEl.textContent = `${rDateStr} at ${rTimeStr}`;

            if (document.getElementById('receipt-total-price')) {
                const rawTotal = String(trackedOrderCache.total || '').replace(/^\$/, '');
                const formatted = rawTotal && !isNaN(Number(rawTotal)) ? '$' + Number(rawTotal).toFixed(2) : (trackedOrderCache.total || 'N/A');
                document.getElementById('receipt-total-price').textContent = formatted;
            }

            document.getElementById('receipt-modal').classList.remove('hidden');
        }

        function closeReceiptModal() {
            document.getElementById('receipt-modal').classList.add('hidden');
        }

        document.getElementById('catalog-storefront').addEventListener('change', () => {
            saveCatalogFilters();
            renderCatalog();
        });

        document.getElementById('catalog-search').addEventListener('input', () => {
            saveCatalogFilters();
            renderCatalog();
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await client.auth.signOut();
            window.location.href = 'login';
        });

        window.addEventListener('focus', async () => {
            await checkSession();
            const trackingTab = document.getElementById('tab-tracking');
            if (trackingTab && !trackingTab.classList.contains('hidden')) {
                syncLiveOrdersQuietly();
            }
        });

        document.addEventListener('visibilitychange', () => {
            const trackingTab = document.getElementById('tab-tracking');
            const isTrackingActive = trackingTab && !trackingTab.classList.contains('hidden');
            if (document.hidden) {
                stopTrackingPoll();
            } else if (isTrackingActive) {
                syncLiveOrdersQuietly();
                startTrackingPoll();
            }
        });

        checkSession();
