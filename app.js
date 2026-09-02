// ==========================================
// 1. ESTADO GLOBAL
// ==========================================
let products = [];
let cart = [];
let bcvRate = 0;
let selectedSize = null; 
let tempImages = ["", "", ""]; 
let currentOrder = null;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchBCVRate();
    loadProducts();
    setupEventListeners();
    if(window.lucide) lucide.createIcons();
});

function setupEventListeners() {
    document.getElementById("open-cart-btn")?.addEventListener("click", openCart);
    document.getElementById("close-cart-btn")?.addEventListener("click", closeCart);
    document.getElementById("open-admin-btn")?.addEventListener("click", openAdminModal);
    
    document.getElementById("search-input")?.addEventListener("input", filterProducts);
    document.getElementById("filter-category")?.addEventListener("change", filterProducts);
}

// ==========================================
// 3. TASA BCV (Firestore + Cálculo)
// ==========================================
async function fetchBCVRate() {
    try {
        const doc = await db.collection("config").doc("rate").get();
        if (doc.exists) bcvRate = doc.data().bcv;
        else bcvRate = 36.5; 
        
        if(document.getElementById("bcv-rate-display")) document.getElementById("bcv-rate-display").textContent = bcvRate.toFixed(2);
        if(document.getElementById("admin-rate-input")) document.getElementById("admin-rate-input").value = bcvRate;
    } catch (e) { bcvRate = 36.5; }
}

async function saveManualRate() {
    const newVal = parseFloat(document.getElementById("admin-rate-input").value);
    if(newVal > 0) {
        await db.collection("config").doc("rate").set({ bcv: newVal });
        bcvRate = newVal;
        showToast("Tasa actualizada ✅");
        setTimeout(() => location.reload(), 1000);
    }
}

// ==========================================
// 4. CATÁLOGO DINÁMICO
// ==========================================
function loadProducts() {
    db.collection("products").onSnapshot(snapshot => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCatalog(products);
        if(document.getElementById("admin-dashboard-view").style.display !== "none") {
            loadAdminInventory();
        }
    });
}

function renderCatalog(items) {
    const container = document.getElementById("products-container");
    if(!container) return;
    container.innerHTML = "";
    items.forEach(p => {
        const displayImg = p.images.find(img => img !== "") || 'img/placeholder.png';
        container.innerHTML += `
            <div class="product-card" onclick="openProductModal('${p.id}')">
                <img src="${displayImg}" loading="lazy">
                <div class="product-info">
                    <h4 class="product-title">${p.name}</h4>
                    <p class="product-price">€ ${p.price.toFixed(2)}</p>
                </div>
            </div>
        `;
    });
}

// ==========================================
// 5. DETALLE DE PRODUCTO (GALERÍA + TALLAS)
// ==========================================
function openProductModal(id) {
    const p = products.find(prod => prod.id === id);
    selectedSize = null; 
    const validImages = p.images.filter(img => img !== "");
    
    const modalBody = document.getElementById("modal-body-content");
    modalBody.innerHTML = `
        <div class="product-detail-layout">
            <div class="gallery-container">
                <div class="main-img-box"><img src="${validImages[0]}" id="main-photo"></div>
                <div class="thumbnails">
                    ${validImages.map((url, i) => `
                        <img src="${url}" onclick="changePhoto('${url}', this)" class="${i===0?'active':''}">
                    `).join('')}
                </div>
            </div>
            <div class="product-info">
                <h2 style="color:var(--morado-oscuro)">${p.name}</h2>
                <h3 style="color:var(--morado-principal); margin: 10px 0;">€ ${p.price.toFixed(2)}</h3>
                <div class="size-selector">
                    <p style="margin-bottom:10px"><strong>Selecciona tu talla:</strong></p>
                    <div class="size-options">
                        ${['S', 'M', 'L', 'XL'].map(size => {
                            const stock = p.sizes[size] || 0;
                            return `<button class="size-btn ${stock <= 0 ? 'disabled' : ''}" 
                                     onclick="selectSize(this, '${size}')" 
                                     ${stock <= 0 ? 'disabled' : ''}>${size}</button>`;
                        }).join('')}
                    </div>
                </div>
                <button class="cta-button" onclick="addToCart('${p.id}')" style="margin-top:20px">Añadir al Carrito</button>
            </div>
        </div>
    `;
    document.getElementById("product-modal").classList.add("active");
}

function changePhoto(url, el) {
    document.getElementById("main-photo").src = url;
    document.querySelectorAll(".thumbnails img").forEach(img => img.classList.remove("active"));
    el.classList.add("active");
}

function selectSize(btn, size) {
    document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSize = size;
}

// ==========================================
// 6. CARRITO Y CHECKOUT
// ==========================================
function addToCart(id) {
    if (!selectedSize) { showToast("⚠️ Selecciona una talla", "error"); return; }
    const p = products.find(prod => prod.id === id);
    const cartItemId = id + "_" + selectedSize;
    const existing = cart.find(item => item.cartItemId === cartItemId);

    if (existing) {
        if (existing.qty < (p.sizes[selectedSize] || 0)) existing.qty++;
        else { showToast("Stock agotado"); return; }
    } else {
        cart.push({ ...p, selectedSize, cartItemId, qty: 1 });
    }
    updateCartUI();
    showToast("¡Añadido! ✨");
    closeProductModal();
    openCart();
}

function updateCartUI() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
        total += (item.price * item.qty);
        container.innerHTML += `
            <div style="display:flex; gap:15px; margin-bottom:15px; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px;">
                <img src="${item.images.find(img => img !== "")}" style="width:60px; height:60px; object-fit:cover; border-radius:10px;">
                <div style="flex:1">
                    <h5 style="margin:0">${item.name}</h5>
                    <small>Talla: ${item.selectedSize} | Cant: ${item.qty}</small>
                </div>
                <strong>€ ${(item.price * item.qty).toFixed(2)}</strong>
                <button onclick="removeFromCart('${item.cartItemId}')" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem;">&times;</button>
            </div>
        `;
    });
    document.getElementById("cart-total").textContent = `€ ${total.toFixed(2)}`;
    document.getElementById("cart-count").textContent = cart.reduce((acc, i) => acc + i.qty, 0);
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.cartItemId !== cartId);
    updateCartUI();
}

function openCheckoutModal() {
    if(cart.length === 0) return showToast("El carrito está vacío");
    closeCart();
    const totalEur = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    document.getElementById("checkout-total-eur").textContent = `€ ${totalEur.toFixed(2)}`;
    document.getElementById("checkout-step-1").style.display = "block";
    document.getElementById("checkout-step-2").style.display = "none";
    document.getElementById("checkout-step-3").style.display = "none";
    document.getElementById("checkout-modal").classList.add("active");
}

async function processOrder(e) {
    e.preventDefault();
    const totalEur = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    currentOrder = {
        orderNumber: "COS-" + Math.floor(1000 + Math.random() * 9000),
        clientName: document.getElementById("client-name").value,
        clientPhone: document.getElementById("client-phone").value,
        totalEur: totalEur,
        paymentStatus: "Pendiente",
        date: new Date().toISOString(),
        items: [...cart]
    };
    document.getElementById("checkout-step-1").style.display = "none";
    document.getElementById("checkout-step-2").style.display = "block";
    document.getElementById("checkout-total-ves").textContent = `Total: ${(totalEur * bcvRate).toFixed(2)} Bs.`;
}

async function registerPayment(e) {
    e.preventDefault();
    currentOrder.paymentRef = document.getElementById("payment-ref").value;
    try {
        await db.collection("orders").add(currentOrder);
        // Descontar Stock
        for (const item of cart) {
            const pRef = db.collection("products").doc(item.id);
            const pDoc = await pRef.get();
            if(pDoc.exists) {
                const newSizes = {...pDoc.data().sizes};
                newSizes[item.selectedSize] = Math.max(0, newSizes[item.selectedSize] - item.qty);
                await pRef.update({ sizes: newSizes });
            }
        }
        document.getElementById("final-order-num").textContent = currentOrder.orderNumber;
        document.getElementById("checkout-step-2").style.display = "none";
        document.getElementById("checkout-step-3").style.display = "block";
        cart = []; updateCartUI();
    } catch (err) { showToast("Error al procesar pago"); }
}

function sendWhatsAppSummary() {
    if(!currentOrder) return;
    const totalVes = (currentOrder.totalEur * bcvRate).toFixed(2);
    let msg = `✨ *NUEVO PEDIDO CÓSMICA* ✨%0A%0A`;
    msg += `📌 *Orden:* ${currentOrder.orderNumber}%0A`;
    msg += `👤 *Cliente:* ${currentOrder.clientName}%0A%0A`;
    msg += `🛍️ *Productos:*%0A`;
    currentOrder.items.forEach(i => {
        msg += `- ${i.name} (${i.selectedSize}) x${i.qty}%0A`;
    });
    msg += `%0A💶 *Total:* €${currentOrder.totalEur.toFixed(2)}%0A`;
    msg += `🇻🇪 *Monto:* ${totalVes} Bs.%0A`;
    msg += `🔢 *Referencia:* ${currentOrder.paymentRef}%0A%0A`;
    msg += `Pagaré por Pago Móvil. ✨`;

    window.open(`https://wa.me/584121727585?text=${msg}`, "_blank");
}

// ==========================================
// 7. ADMINISTRACIÓN (Editar + Ventas Manuales)
// ==========================================

async function handleAdminLogin(e) {
    e.preventDefault();
    const passInput = document.getElementById("admin-pass").value;
    try {
        const doc = await db.collection("config").doc("admin").get();
        if (doc.exists && doc.data().password === passInput) {
            document.getElementById("admin-login-view").style.display = "none";
            document.getElementById("admin-dashboard-view").style.display = "block";
            loadAdminInventory();
        } else { showToast("Clave incorrecta", "error"); }
    } catch (err) { showToast("Error de conexión"); }
}

function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(`tab-${tab}`).style.display = "block";
    
    // Activar el botón visualmente
    const btn = document.querySelector(`button[onclick*="${tab}"]`);
    if(btn) btn.classList.add("active");

    if(tab === 'sales') loadAdminSales();
}

// --- GESTIÓN DE INVENTARIO ---

function loadAdminInventory() {
    const list = document.getElementById("admin-inventory-list");
    if(!list) return;
    list.innerHTML = products.map(p => `
        <div style="display:flex; justify-content:space-between; background:#fff; padding:12px; margin-bottom:10px; border-radius:12px; color:#333; align-items:center; border:1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div><strong>${p.name}</strong><br><small>S:${p.sizes.S} M:${p.sizes.M} L:${p.sizes.L} XL:${p.sizes.XL}</small></div>
            <div style="display:flex; gap:10px;">
                <button onclick="editProduct('${p.id}')" style="color:var(--morado-principal); background:none; border:none; cursor:pointer; font-weight:bold;">Editar</button>
                <button onclick="deleteProduct('${p.id}')" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function editProduct(id) {
    const p = products.find(prod => prod.id === id);
    if(!p) return;

    // Llenar formulario
    document.getElementById("edit-prod-id").value = p.id;
    document.getElementById("prod-name").value = p.name;
    document.getElementById("prod-cat").value = p.category;
    document.getElementById("prod-price").value = p.price;
    document.getElementById("stock-s").value = p.sizes.S || 0;
    document.getElementById("stock-m").value = p.sizes.M || 0;
    document.getElementById("stock-l").value = p.sizes.L || 0;
    document.getElementById("stock-xl").value = p.sizes.XL || 0;
    
    document.getElementById("form-title").textContent = "Editando Producto";
    document.getElementById("product-form-box").style.display = "block";
    tempImages = [...p.images]; // Mantener imágenes actuales
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById("edit-prod-id").value;
    const priceVal = document.getElementById("prod-price").value;

    const pData = {
        name: document.getElementById("prod-name").value,
        category: document.getElementById("prod-cat").value,
        price: parseFloat(priceVal),
        images: [...tempImages],
        sizes: {
            S: parseInt(document.getElementById("stock-s").value) || 0,
            M: parseInt(document.getElementById("stock-m").value) || 0,
            L: parseInt(document.getElementById("stock-l").value) || 0,
            XL: parseInt(document.getElementById("stock-xl").value) || 0
        },
        date: new Date().toISOString()
    };

    try {
        if(id) {
            await db.collection("products").doc(id).update(pData);
            showToast("✅ Actualizado");
        } else {
            await db.collection("products").add(pData);
            showToast("✅ Publicado");
        }
        closeProductForm();
        e.target.reset();
    } catch (err) { showToast("❌ Error"); }
}

function closeProductForm() {
    document.getElementById("product-form-box").style.display = "none";
    document.getElementById("edit-prod-id").value = "";
    document.getElementById("form-title").textContent = "Crear Nuevo Producto";
    tempImages = ["", "", ""];
}

async function deleteProduct(id) {
    if(confirm("¿Eliminar producto definitivamente?")) await db.collection("products").doc(id).delete();
}

// --- GESTIÓN DE VENTAS ---

function loadAdminSales() {
    db.collection("orders").orderBy("date", "desc").onSnapshot(snapshot => {
        const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById("stat-total-sales").textContent = sales.length;
        const total = sales.reduce((acc, s) => acc + s.totalEur, 0);
        document.getElementById("stat-total-eur").textContent = `€ ${total.toFixed(2)}`;
        
        document.getElementById("admin-sales-list").innerHTML = sales.map(s => `
            <div style="background:#fff; padding:12px; margin-bottom:10px; border-radius:12px; color:#333; display:flex; justify-content:space-between; border:1px solid #ddd;">
                <div>
                    <strong>${s.clientName}</strong><br>
                    <small>${s.orderNumber} - €${s.totalEur.toFixed(2)} - ${s.paymentStatus}</small>
                </div>
                <button onclick="deleteOrder('${s.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `).join('');
    });
}

function openManualSaleForm() {
    const select = document.getElementById("manual-prod-select");
    select.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (€${p.price})</option>`).join('');
    document.getElementById("manual-sale-box").style.display = "block";
}

async function saveManualSale(e) {
    e.preventDefault();
    const prodId = document.getElementById("manual-prod-select").value;
    const size = document.getElementById("manual-size-select").value;
    const qty = parseInt(document.getElementById("manual-qty").value);
    const p = products.find(prod => prod.id === prodId);

    const manualOrder = {
        orderNumber: "MANUAL-" + Date.now().toString().slice(-4),
        clientName: document.getElementById("manual-client").value + " (Manual)",
        totalEur: p.price * qty,
        paymentStatus: "Pagado",
        date: new Date().toISOString(),
        items: [{ name: p.name, selectedSize: size, qty: qty, price: p.price }]
    };

    try {
        await db.collection("orders").add(manualOrder);
        // Descontar stock
        const pRef = db.collection("products").doc(prodId);
        const pDoc = await pRef.get();
        const newSizes = {...pDoc.data().sizes};
        newSizes[size] = Math.max(0, newSizes[size] - qty);
        await pRef.update({ sizes: newSizes });

        showToast("✅ Venta manual registrada");
        document.getElementById("manual-sale-box").style.display = "none";
        e.target.reset();
    } catch (err) { showToast("❌ Error"); }
}

async function deleteOrder(id) {
    if(confirm("¿Borrar registro de venta?")) await db.collection("orders").doc(id).delete();
}

// ==========================================
// 8. UTILIDADES Y OTROS
// ==========================================

function previewImg(input, index) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { tempImages[index - 1] = e.target.result; };
    reader.readAsDataURL(file);
}

function filterProducts() {
    const search = document.getElementById("search-input").value.toLowerCase();
    const cat = document.getElementById("filter-category").value;
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(search) && (cat === "" || p.category === cat)
    );
    renderCatalog(filtered);
}

function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast show";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}

function openAdminModal() { document.getElementById("admin-modal").classList.add("active"); }
function closeAdminModal() { document.getElementById("admin-modal").classList.remove("active"); }
function closeProductModal() { document.getElementById("product-modal").classList.remove("active"); }
function openCart() { document.getElementById("cart-drawer").classList.add("active"); document.getElementById("cart-drawer-overlay").classList.add("active"); }
function closeCart() { document.getElementById("cart-drawer").classList.remove("active"); document.getElementById("cart-drawer-overlay").classList.remove("active"); }
function openProductForm() { document.getElementById("product-form-box").style.display = "block"; }
function closeCheckoutModal() { document.getElementById("checkout-modal").classList.remove("active"); }
function adminLogout() { location.reload(); }
