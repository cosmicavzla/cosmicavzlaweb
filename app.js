// ==========================================
// ESTADO GLOBAL Y VARIABLES
// ==========================================
let products = [];
let cart = [];
let bcvRate = 0;
let currentAdminProduct = null;
let currentEditingSaleId = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchBCVRate();
    loadProducts();
    setupEventListeners();
});

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Abrir/Cerrar Carrito
    document.getElementById("open-cart-btn")?.addEventListener("click", openCart);
    document.getElementById("close-cart-btn")?.addEventListener("click", closeCart);
    document.getElementById("cart-drawer-overlay")?.addEventListener("click", closeCart);

    // Modal de Detalle de Producto
    document.getElementById("close-modal-btn")?.addEventListener("click", closeProductModal);
    
    // Modal de Checkout
    document.getElementById("close-checkout-btn")?.addEventListener("click", closeCheckoutModal);
    document.getElementById("checkout-btn")?.addEventListener("click", openCheckoutModal);

    // Modal de Admin
    document.getElementById("open-admin-btn")?.addEventListener("click", openAdminModal);

    // Filtros y Búsqueda
    document.getElementById("search-input")?.addEventListener("input", filterProducts);
    document.getElementById("filter-category")?.addEventListener("change", filterProducts);
    document.getElementById("sort-by")?.addEventListener("change", filterProducts);

    // Categorías rápidas
    document.querySelectorAll(".category-card").forEach(card => {
        card.addEventListener("click", () => {
            const cat = card.getAttribute("data-categoria");
            const select = document.getElementById("filter-category");
            if (select) {
                select.value = cat;
                filterProducts();
                document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
            }
        });
    });
}

// ==========================================
// TASA BCV DESDE API / FIRESTORE
// ==========================================
async function fetchBCVRate() {
    try {
        const doc = await db.collection("config").doc("rate").get();
        if (doc.exists && doc.data().bcv) {
            bcvRate = parseFloat(doc.data().bcv);
        } else {
            // Intentar API pública en caso de no estar configurada en BD
            const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
            const data = await res.json();
            bcvRate = data.promedio || 36.5;
        }
    } catch (e) {
        console.error("Error al obtener la tasa BCV:", e);
        bcvRate = 36.50; // Tasa por defecto de respaldo
    }
    
    const rateDisplay = document.getElementById("bcv-rate-display");
    if (rateDisplay) rateDisplay.textContent = bcvRate.toFixed(2);
    
    const adminRateInput = document.getElementById("admin-rate-input");
    if (adminRateInput) adminRateInput.value = bcvRate;
}

// ==========================================
// CARGAR PRODUCTOS DESDE FIRESTORE
// ==========================================
function loadProducts() {
    db.collection("products").onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderProducts(products);
        populateManualSaleSelect();
    });
}

// ==========================================
// RENDERIZAR PRODUCTOS EN EL CATÁLOGO
// ==========================================
function renderProducts(items) {
    const container = document.getElementById("products-container");
    if (!container) return;
    container.innerHTML = "";

    if (items.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--texto-suave);">No se encontraron productos.</p>`;
        return;
    }

    items.forEach(product => {
        const priceDisplay = product.isPromo && product.promoPrice 
            ? `<span class="old-price">€ ${parseFloat(product.price).toFixed(2)}</span>
               <span class="product-price">€ ${parseFloat(product.promoPrice).toFixed(2)}</span>`
            : `<span class="product-price">€ ${parseFloat(product.price).toFixed(2)}</span>`;

        const promoBadge = product.isPromo 
            ? `<span class="promo-badge">PROMO</span>` 
            : "";

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-img-box" onclick="openProductModal('${product.id}')">
                ${promoBadge}
                <img src="${product.image || 'img/icono.png'}" alt="${product.name}">
            </div>
            <div class="product-info">
                <h4 class="product-title">${product.name}</h4>
                <div class="price-box">
                    ${priceDisplay}
                </div>
                <p style="font-size: 0.8rem; color: var(--texto-suave); margin-bottom: 10px;">
                    Stock: ${product.stock}
                </p>
                <button class="btn-add-cart" 
                    ${product.stock <= 0 ? "disabled" : ""} 
                    onclick="addToCart('${product.id}')">
                    ${product.stock <= 0 ? "Agotado" : "Agregar al Carrito"}
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// MODAL DETALLE DE PRODUCTO (CON LA MODIFICACIÓN)
// ==========================================
function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modalBody = document.getElementById("modal-body-content");
    const modalOverlay = document.getElementById("product-modal");
    if (!modalBody || !modalOverlay) return;

    const currentPrice = product.isPromo && product.promoPrice ? product.promoPrice : product.price;

    // AQUÍ ESTÁ LA MODIFICACIÓN:
    // Se removió el style="width:100%; max-width:220px; height:220px;" que limitaba la foto.
    // Ahora usa la clase product-detail-img-box controlada enteramente desde style.css.
    modalBody.innerHTML = `
        <div class="product-detail-layout">
            <div class="product-detail-img-box">
                <img src="${product.image || 'img/icono.png'}" alt="${product.name}">
            </div>
            <div>
                <h3 style="color: var(--morado-texto); margin-bottom: 10px;">${product.name}</h3>
                <h4 style="color: var(--morado-principal); font-size: 1.4rem; margin-bottom: 15px;">
                    € ${parseFloat(currentPrice).toFixed(2)}
                </h4>
                <p style="font-size: 0.9rem; color: var(--texto-suave); margin-bottom: 8px;">
                    <strong>Categoría:</strong> ${product.category ? product.category.toUpperCase() : 'GENERAL'}
                </p>
                <p style="font-size: 0.9rem; color: var(--texto-suave); margin-bottom: 20px;">
                    <strong>Disponible:</strong> ${product.stock} unidades
                </p>
                <p style="font-size: 0.85rem; color: var(--texto-suave); margin-bottom: 20px;">
                    Producto Cósmica ✨
                </p>
                <button class="cta-button" style="width: 100%;" 
                    ${product.stock <= 0 ? "disabled" : ""} 
                    onclick="addToCart('${product.id}'); closeProductModal();">
                    ${product.stock <= 0 ? "Agotado" : "Agregar al Carrito"}
                </button>
            </div>
        </div>
    `;

    modalOverlay.classList.add("active");
}

function closeProductModal() {
    const modalOverlay = document.getElementById("product-modal");
    if (modalOverlay) modalOverlay.classList.remove("active");
}

// ==========================================
// FILTROS Y BÚSQUEDA
// ==========================================
function filterProducts() {
    const searchVal = document.getElementById("search-input")?.value.toLowerCase().trim() || "";
    const categoryVal = document.getElementById("filter-category")?.value || "";
    const sortVal = document.getElementById("sort-by")?.value || "default";

    let filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal);
        const matchesCat = categoryVal === "" || p.category === categoryVal;
        return matchesSearch && matchesCat;
    });

    if (sortVal === "price-asc") {
        filtered.sort((a, b) => {
            const priceA = a.isPromo && a.promoPrice ? a.promoPrice : a.price;
            const priceB = b.isPromo && b.promoPrice ? b.promoPrice : b.price;
            return priceA - priceB;
        });
    } else if (sortVal === "price-desc") {
        filtered.sort((a, b) => {
            const priceA = a.isPromo && a.promoPrice ? a.promoPrice : a.price;
            const priceB = b.isPromo && b.promoPrice ? b.promoPrice : b.price;
            return priceB - priceA;
        });
    }

    renderProducts(filtered);
}

// ==========================================
// GESTIÓN DEL CARRITO
// ==========================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    const itemInCart = cart.find(item => item.id === productId);
    if (itemInCart) {
        if (itemInCart.qty < product.stock) {
            itemInCart.qty++;
        } else {
            alert("No hay más stock disponible de este producto.");
            return;
        }
    } else {
        const finalPrice = product.isPromo && product.promoPrice ? product.promoPrice : product.price;
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(finalPrice),
            image: product.image,
            qty: 1
        });
    }

    updateCartUI();
    openCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateCartQty(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    const maxStock = product ? product.stock : 99;

    item.qty += change;
    if (item.qty <= 0) {
        removeFromCart(productId);
    } else if (item.qty > maxStock) {
        item.qty = maxStock;
        alert("Alcanzaste el límite de stock disponible.");
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById("cart-items-container");
    const countBadge = document.getElementById("cart-count");
    const subtotalDisplay = document.getElementById("cart-subtotal");
    const totalDisplay = document.getElementById("cart-total");

    if (!container) return;

    const totalCount = cart.reduce((acc, i) => acc + i.qty, 0);
    const totalPrice = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);

    if (countBadge) countBadge.textContent = totalCount;
    if (subtotalDisplay) subtotalDisplay.textContent = `€ ${totalPrice.toFixed(2)}`;
    if (totalDisplay) totalDisplay.textContent = `€ ${totalPrice.toFixed(2)}`;

    container.innerHTML = "";
    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--texto-suave); margin-top: 30px;">Tu carrito está vacío.</p>`;
        return;
    }

    cart.forEach(item => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 12px; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--gris-borde);";
        row.innerHTML = `
            <img src="${item.image || 'img/icono.png'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
            <div style="flex: 1;">
                <h5 style="margin: 0; color: var(--morado-texto); font-size: 0.9rem;">${item.name}</h5>
                <span style="color: var(--morado-principal); font-weight: bold; font-size: 0.85rem;">€ ${item.price.toFixed(2)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <button onclick="updateCartQty('${item.id}', -1)" style="border:1px solid #ccc; background:#fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">-</button>
                <span style="font-size:0.85rem; font-weight:bold;">${item.qty}</span>
                <button onclick="updateCartQty('${item.id}', 1)" style="border:1px solid #ccc; background:#fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">+</button>
            </div>
            <button onclick="removeFromCart('${item.id}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:1.1rem;">&times;</button>
        `;
        container.appendChild(row);
    });
}

function openCart() {
    document.getElementById("cart-drawer")?.classList.add("active");
    document.getElementById("cart-drawer-overlay")?.classList.add("active");
}

function closeCart() {
    document.getElementById("cart-drawer")?.classList.remove("active");
    document.getElementById("cart-drawer-overlay")?.classList.remove("active");
}

// ==========================================
// PROCESO DE CHECKOUT / PEDIDO EN LÍNEA
// ==========================================
let currentOrder = null;

function openCheckoutModal() {
    if (cart.length === 0) {
        alert("Tu carrito está vacío.");
        return;
    }

    closeCart();
    
    // Resetear pasos
    document.getElementById("checkout-step-1").style.display = "block";
    document.getElementById("checkout-step-2").style.display = "none";
    document.getElementById("checkout-step-3").style.display = "none";
    document.getElementById("checkout-step-4").style.display = "none";

    const totalEur = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    document.getElementById("checkout-total-eur").textContent = `€ ${totalEur.toFixed(2)}`;

    document.getElementById("checkout-modal").classList.add("active");
}

function closeCheckoutModal() {
    document.getElementById("checkout-modal").classList.remove("active");
}

async function processOrder(e) {
    e.preventDefault();

    const name = document.getElementById("client-name").value;
    const phone = document.getElementById("client-phone").value;
    const notes = document.getElementById("client-notes").value;
    const totalEur = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);

    const orderNumber = "COS-" + Math.floor(1000 + Math.random() * 9000);

    currentOrder = {
        orderNumber,
        clientName: name,
        clientPhone: phone,
        notes: notes,
        items: [...cart],
        totalEur: totalEur,
        status: "Pendiente",
        paymentStatus: "Pendiente",
        date: new Date().toISOString()
    };

    try {
        const docRef = await db.collection("orders").add(currentOrder);
        currentOrder.id = docRef.id;

        // Descontar stock
        for (const item of cart) {
            const pRef = db.collection("products").doc(item.id);
            const pDoc = await pRef.get();
            if (pDoc.exists) {
                const currentStock = pDoc.data().stock || 0;
                await pRef.update({ stock: Math.max(0, currentStock - item.qty) });
            }
        }

        // Pasar a paso 2
        document.getElementById("checkout-step-1").style.display = "none";
        document.getElementById("checkout-step-2").style.display = "block";
        document.getElementById("order-number-display").textContent = orderNumber;
        document.getElementById("summary-client-name").textContent = name;
        document.getElementById("summary-total-eur").textContent = `€ ${totalEur.toFixed(2)}`;

        // Vaciar carrito web
        cart = [];
        updateCartUI();
    } catch (err) {
        console.error("Error al procesar pedido:", err);
        alert("Hubo un error al guardar el pedido.");
    }
}

function goToPaymentStep() {
    document.getElementById("checkout-step-2").style.display = "none";
    document.getElementById("checkout-step-3").style.display = "block";

    const totalVes = currentOrder.totalEur * bcvRate;
    document.getElementById("checkout-total-ves").textContent = `${totalVes.toFixed(2)} Bs.`;
}

async function registerPayment(e) {
    e.preventDefault();

    const bank = document.getElementById("payment-bank").value;
    const ref = document.getElementById("payment-ref").value;

    if (!currentOrder || !currentOrder.id) return;

    try {
        await db.collection("orders").doc(currentOrder.id).update({
            paymentBank: bank,
            paymentRef: ref,
            paymentStatus: "Por Verificar"
        });

        currentOrder.paymentBank = bank;
        currentOrder.paymentRef = ref;

        document.getElementById("checkout-step-3").style.display = "none";
        document.getElementById("checkout-step-4").style.display = "block";
        document.getElementById("final-order-num").textContent = currentOrder.orderNumber;
    } catch (err) {
        console.error("Error al registrar pago:", err);
        alert("Error al actualizar información del pago.");
    }
}

function sendWhatsAppSummary() {
    if (!currentOrder) return;
    const totalVes = (currentOrder.totalEur * bcvRate).toFixed(2);
    
    let text = `✨ *NUEVO PEDIDO CÓSMICA* ✨\n`;
    text += `📌 *Nº Pedido:* ${currentOrder.orderNumber}\n`;
    text += `👤 *Cliente:* ${currentOrder.clientName}\n`;
    text += `📱 *Teléfono:* ${currentOrder.clientPhone}\n\n`;
    text += `🛍️ *Productos:*\n`;
    
    currentOrder.items.forEach(i => {
        text += `- ${i.name} (x${i.qty}) - €${(i.price * i.qty).toFixed(2)}\n`;
    });

    text += `\n💶 *Total Eur:* €${currentOrder.totalEur.toFixed(2)}\n`;
    text += `🇻🇪 *Total Bs (Tasa ${bcvRate.toFixed(2)}):* ${totalVes} Bs.\n`;
    text += `🏦 *Banco Origen:* ${currentOrder.paymentBank}\n`;
    text += `🔢 *Ref Pago:* ${currentOrder.paymentRef}\n`;

    const url = `https://wa.me/584161727585?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
}

function sendDirectPaymentWhatsApp() {
    if (!currentOrder) return;
    let text = `Hola Cósmica ✨, creé el pedido *${currentOrder.orderNumber}* por un total de €${currentOrder.totalEur.toFixed(2)} y quisiera acordar mi pago directamente por acá.`;
    const url = `https://wa.me/584161727585?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
}

// ==========================================
// PANEL DE ADMINISTRACIÓN
// ==========================================
function openAdminModal() {
    document.getElementById("admin-modal").classList.add("active");
}

function closeAdminModal() {
    document.getElementById("admin-modal").classList.remove("active");
}

function handleAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById("admin-pass").value;
    if (pass === "cosmica2026") { // Cambia tu clave si gustas
        document.getElementById("admin-login-view").style.display = "none";
        document.getElementById("admin-dashboard-view").style.display = "block";
        loadAdminInventory();
        loadAdminSales();
    } else {
        alert("Contraseña incorrecta.");
    }
}

function adminLogout() {
    document.getElementById("admin-login-view").style.display = "block";
    document.getElementById("admin-dashboard-view").style.display = "none";
    document.getElementById("admin-pass").value = "";
}

function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach(c => c.style.display = "none");

    document.getElementById(`btn-tab-${tab}`)?.classList.add("active");
    document.getElementById(`tab-${tab}`).style.display = "block";
}

// ---- INVENTARIO (ADMIN) ----
function loadAdminInventory() {
    const list = document.getElementById("admin-inventory-list");
    if (!list) return;
    list.innerHTML = "";

    products.forEach(p => {
        const row = document.createElement("div");
        row.className = "admin-item-row";
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 15px;";
        row.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <img src="${p.image || 'img/icono.png'}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;">
                <div>
                    <strong style="font-size: 0.85rem; color: var(--morado-texto);">${p.name}</strong><br>
                    <small style="color: var(--texto-suave);">Stock: ${p.stock} | €${parseFloat(p.price).toFixed(2)} ${p.isPromo ? '(Promo)' : ''}</small>
                </div>
            </div>
            <button onclick="editProduct('${p.id}')" style="background: var(--morado-pastel); border:none; padding: 5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:bold; color: var(--morado-texto);">Editar</button>
        `;
        list.appendChild(row);
    });
}

function openProductForm() {
    currentAdminProduct = null;
    document.getElementById("form-product-title").textContent = "Nuevo Producto";
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-name").value = "";
    document.getElementById("prod-cat").value = "pijamas";
    document.getElementById("prod-stock").value = 1;
    document.getElementById("prod-price").value = "";
    document.getElementById("prod-promo-price").value = "";
    document.getElementById("prod-is-promo").checked = false;
    document.getElementById("prod-img").value = "";
    document.getElementById("prod-img-preview-container").style.display = "none";
    document.getElementById("btn-delete-prod").style.display = "none";

    document.getElementById("product-form-box").style.display = "block";
}

function closeProductForm() {
    document.getElementById("product-form-box").style.display = "none";
}

function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    currentAdminProduct = p;
    document.getElementById("form-product-title").textContent = "Editar Producto";
    document.getElementById("prod-id").value = p.id;
    document.getElementById("prod-name").value = p.name;
    document.getElementById("prod-cat").value = p.category || "pijamas";
    document.getElementById("prod-stock").value = p.stock;
    document.getElementById("prod-price").value = p.price;
    document.getElementById("prod-promo-price").value = p.promoPrice || "";
    document.getElementById("prod-is-promo").checked = !!p.isPromo;
    document.getElementById("prod-img").value = p.image || "";

    if (p.image) {
        document.getElementById("prod-img-preview").src = p.image;
        document.getElementById("prod-img-preview-container").style.display = "flex";
    } else {
        document.getElementById("prod-img-preview-container").style.display = "none";
    }

    document.getElementById("btn-delete-prod").style.display = "inline-block";
    document.getElementById("product-form-box").style.display = "block";
}

function handleProductImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        document.getElementById("prod-img").value = base64;
        document.getElementById("prod-img-preview").src = base64;
        document.getElementById("prod-img-preview-container").style.display = "flex";
    };
    reader.readAsDataURL(file);
}

function clearProductImage() {
    document.getElementById("prod-img").value = "";
    document.getElementById("prod-img-file").value = "";
    document.getElementById("prod-img-preview-container").style.display = "none";
}

async function saveProduct(e) {
    e.preventDefault();

    const id = document.getElementById("prod-id").value;
    const name = document.getElementById("prod-name").value;
    const category = document.getElementById("prod-cat").value;
    const stock = parseInt(document.getElementById("prod-stock").value) || 0;
    const price = parseFloat(document.getElementById("prod-price").value) || 0;
    const promoPriceVal = document.getElementById("prod-promo-price").value;
    const promoPrice = promoPriceVal ? parseFloat(promoPriceVal) : null;
    const isPromo = document.getElementById("prod-is-promo").checked;
    const image = document.getElementById("prod-img").value;

    const productData = { name, category, stock, price, promoPrice, isPromo, image };

    try {
        if (id) {
            await db.collection("products").doc(id).update(productData);
        } else {
            await db.collection("products").add(productData);
        }
        closeProductForm();
    } catch (err) {
        console.error("Error al guardar producto:", err);
        alert("Error al guardar producto.");
    }
}

async function deleteCurrentProduct() {
    const id = document.getElementById("prod-id").value;
    if (!id) return;

    if (confirm("¿Seguro que deseas eliminar este producto?")) {
        try {
            await db.collection("products").doc(id).delete();
            closeProductForm();
        } catch (err) {
            console.error("Error al eliminar producto:", err);
        }
    }
}

// ---- TASA BCV (ADMIN) ----
async function saveManualRate() {
    const val = parseFloat(document.getElementById("admin-rate-input").value);
    if (!val || val <= 0) {
        alert("Ingresa una tasa válida.");
        return;
    }

    try {
        await db.collection("config").doc("rate").set({ bcv: val });
        bcvRate = val;
        document.getElementById("bcv-rate-display").textContent = bcvRate.toFixed(2);
        alert("Tasa BCV actualizada correctamente.");
    } catch (err) {
        console.error("Error actualizando tasa:", err);
    }
}

// ---- VENTAS (ADMIN) ----
function loadAdminSales() {
    db.collection("orders").orderBy("date", "desc").onSnapshot((snapshot) => {
        const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let totalCount = sales.length;
        let totalEur = sales.reduce((acc, s) => acc + (s.totalEur || 0), 0);

        document.getElementById("stat-total-sales").textContent = totalCount;
        document.getElementById("stat-total-eur").textContent = `€ ${totalEur.toFixed(2)}`;

        const container = document.getElementById("admin-sales-list");
        if (!container) return;
        container.innerHTML = "";

        sales.forEach(sale => {
            const isPagado = sale.paymentStatus === "Pagado" || sale.paymentStatus === "Pago Completo";
            const row = document.createElement("div");
            row.className = "sales-item-row";
            row.innerHTML = `
                <div class="sales-item-details">
                    <strong>${sale.orderNumber || 'COS-EXT'}</strong> - ${sale.clientName}<br>
                    <small>Total: €${(sale.totalEur || 0).toFixed(2)} | Método: ${sale.paymentMethod || sale.paymentBank || 'N/A'}</small>
                </div>
                <div class="sales-item-actions">
                    <span class="payment-status-badge ${isPagado ? 'pagado' : 'pendiente'}">
                        ${sale.paymentStatus || 'Pendiente'}
                    </span>
                    <button class="btn-action-sm btn-status-sale" title="Cambiar Estado de Pago" onclick="toggleSaleStatus('${sale.id}', '${sale.paymentStatus}')">🔄</button>
                    <button class="btn-action-sm btn-delete-sale" title="Eliminar Venta" onclick="deleteSale('${sale.id}')">🗑️</button>
                </div>
            `;
            container.appendChild(row);
        });
    });
}

async function toggleSaleStatus(id, currentStatus) {
    const newStatus = (currentStatus === "Pagado" || currentStatus === "Pago Completo") ? "Pendiente" : "Pagado";
    try {
        await db.collection("orders").doc(id).update({ paymentStatus: newStatus });
    } catch (e) {
        console.error("Error al cambiar estado:", e);
    }
}

async function deleteSale(id) {
    if (confirm("¿Deseas borrar este registro de venta?")) {
        try {
            await db.collection("orders").doc(id).delete();
        } catch (e) {
            console.error("Error al eliminar venta:", e);
        }
    }
}

// Venta Manual Presencial
function populateManualSaleSelect() {
    const select = document.getElementById("manual-prod-select");
    if (!select) return;
    select.innerHTML = `<option value="">Selecciona producto</option>`;

    products.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.name} (€${p.price})`;
        select.appendChild(option);
    });
}

function openManualSaleForm() {
    document.getElementById("manual-sale-form-box").style.display = "block";
}

function hideManualSaleForm() {
    document.getElementById("manual-sale-form-box").style.display = "none";
}

async function saveManualSale(e) {
    e.preventDefault();

    const clientName = document.getElementById("manual-client").value;
    const prodId = document.getElementById("manual-prod-select").value;
    const qty = parseInt(document.getElementById("manual-qty").value) || 1;
    const paymentMethod = document.getElementById("manual-payment-method").value;
    const paymentStatus = document.getElementById("manual-payment-status").value;

    const product = products.find(p => p.id === prodId);
    if (!product) return;

    const unitPrice = product.isPromo && product.promoPrice ? product.promoPrice : product.price;
    const totalEur = unitPrice * qty;
    const orderNumber = "COS-MAN-" + Math.floor(100 + Math.random() * 900);

    const manualOrder = {
        orderNumber,
        clientName,
        items: [{ id: product.id, name: product.name, price: unitPrice, qty }],
        totalEur,
        paymentMethod,
        paymentStatus,
        isManual: true,
        date: new Date().toISOString()
    };

    try {
        await db.collection("orders").add(manualOrder);
        
        // Descontar stock
        const pRef = db.collection("products").doc(product.id);
        const pDoc = await pRef.get();
        if (pDoc.exists) {
            const currentStock = pDoc.data().stock || 0;
            await pRef.update({ stock: Math.max(0, currentStock - qty) });
        }

        hideManualSaleForm();
        document.getElementById("manual-sale-form").reset();
    } catch (err) {
        console.error("Error guardando venta manual:", err);
    }
}