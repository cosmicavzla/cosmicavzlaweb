// ==========================================
// ESTADO GLOBAL
// ==========================================
let products = [];
let cart = [];
let bcvRate = 0;
let selectedSize = null; 
let tempImages = ["", "", ""]; 
let currentOrder = null;

// ==========================================
// INICIALIZACIÓN
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

// --- TASA BCV ---
async function fetchBCVRate() {
    try {
        const doc = await db.collection("config").doc("rate").get();
        if (doc.exists) bcvRate = doc.data().bcv;
        else bcvRate = 36.5; 
        const display = document.getElementById("bcv-rate-display");
        if(display) display.textContent = bcvRate.toFixed(2);
        const input = document.getElementById("admin-rate-input");
        if(input) input.value = bcvRate;
    } catch (e) { bcvRate = 36.5; }
}

async function saveManualRate() {
    const newVal = parseFloat(document.getElementById("admin-rate-input").value);
    if(newVal > 0) {
        await db.collection("config").doc("rate").set({ bcv: newVal });
        bcvRate = newVal;
        document.getElementById("bcv-rate-display").textContent = bcvRate.toFixed(2);
        showToast("Tasa actualizada ✅");
    }
}

// --- CARGAR PRODUCTOS ---
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
        container.innerHTML += `
            <div class="product-card" onclick="openProductModal('${p.id}')">
                <img src="${p.images[0] || 'img/placeholder.png'}" loading="lazy">
                <div class="product-info">
                    <h4 class="product-title">${p.name}</h4>
                    <p class="product-price">€ ${p.price.toFixed(2)}</p>
                </div>
            </div>
        `;
    });
}

// ==========================================
// MODAL DE PRODUCTO (GALERÍA + TALLAS)
// ==========================================
function openProductModal(id) {
    const p = products.find(prod => prod.id === id);
    selectedSize = null; 
    
    const modalBody = document.getElementById("modal-body-content");
    modalBody.innerHTML = `
        <div class="product-detail-layout">
            <div class="gallery-container">
                <div class="main-img-box"><img src="${p.images[0]}" id="main-photo"></div>
                <div class="thumbnails">
                    ${p.images.filter(url => url !== "").map((url, i) => `
                        <img src="${url}" onclick="changePhoto('${url}', this)" class="${i===0?'active':''}">
                    `).join('')}
                </div>
            </div>
            <div class="product-info">
                <h2>${p.name}</h2>
                <h3 style="color:var(--morado-principal)">€ ${p.price.toFixed(2)}</h3>
                <div class="size-selector">
                    <p><strong>Selecciona tu talla:</strong></p>
                    <div class="size-options">
                        ${['S', 'M', 'L'].map(size => {
                            const stock = p.sizes[size] || 0;
                            return `<button class="size-btn ${stock <= 0 ? 'disabled' : ''}" 
                                     onclick="selectSize(this, '${size}')" 
                                     ${stock <= 0 ? 'disabled' : ''}>${size}</button>`;
                        }).join('')}
                    </div>
                </div>
                <button class="cta-button" onclick="addToCart('${p.id}')" style="width:100%">Añadir al Carrito</button>
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
// GESTIÓN DEL CARRITO
// ==========================================
function addToCart(id) {
    if (!selectedSize) { showToast("⚠️ Elige una talla", "error"); return; }
    const p = products.find(prod => prod.id === id);
    const cartItemId = id + "_" + selectedSize;
    const existing = cart.find(item => item.cartItemId === cartItemId);

    if (existing) {
        if (existing.qty < p.sizes[selectedSize]) existing.qty++;
        else { showToast("Stock agotado"); return; }
    } else {
        cart.push({ ...p, selectedSize, cartItemId, qty: 1 });
    }
    updateCartUI();
    showToast("¡Añadido! ✨");
    closeProductModal();
}

function updateCartUI() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
        total += (item.price * item.qty);
        container.innerHTML += `
            <div class="cart-item" style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                <img src="${item.images[0]}" style="width:50px; height:50px; object-fit:cover; border-radius:5px;">
                <div style="flex:1">
                    <h5 style="margin:0">${item.name}</h5>
                    <small>Talla: ${item.selectedSize} | Cant: ${item.qty}</small>
                </div>
                <strong>€ ${(item.price * item.qty).toFixed(2)}</strong>
            </div>
        `;
    });
    document.getElementById("cart-total").textContent = `€ ${total.toFixed(2)}`;
    document.getElementById("cart-count").textContent = cart.reduce((acc, i) => acc + i.qty, 0);
}

// ==========================================
// PROCESO DE CHECKOUT (PASOS)
// ==========================================
function openCheckoutModal() {
    if(cart.length === 0) return showToast("Carrito vacío");
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
        items: cart
    };
    
    document.getElementById("checkout-step-1").style.display = "none";
    document.getElementById("checkout-step-2").style.display = "block";
    document.getElementById("checkout-total-ves").textContent = `Total: ${(totalEur * bcvRate).toFixed(2)} Bs.`;
}

async function registerPayment(e) {
    e.preventDefault();
    currentOrder.paymentRef = document.getElementById("payment-ref").value;
    const docRef = await db.collection("orders").add(currentOrder);
    
    // Descontar Stock
    for (const item of cart) {
        const pRef = db.collection("products").doc(item.id);
        const pDoc = await pRef.get();
        const newSizes = {...pDoc.data().sizes};
        newSizes[item.selectedSize] -= item.qty;
        await pRef.update({ sizes: newSizes });
    }

    document.getElementById("final-order-num").textContent = currentOrder.orderNumber;
    document.getElementById("checkout-step-2").style.display = "none";
    document.getElementById("checkout-step-3").style.display = "block";
    cart = []; updateCartUI();
}

function sendWhatsAppSummary() {
    const text = `Hola Cósmica! Reporto mi pago.\nPedido: ${currentOrder.orderNumber}\nCliente: ${currentOrder.clientName}\nRef: ${currentOrder.paymentRef}`;
    window.open(`https://wa.me/584161727585?text=${encodeURIComponent(text)}`);
}

// ==========================================
// ADMINISTRACIÓN
// ==========================================
async function handleAdminLogin(e) {
    e.preventDefault();
    const passInput = document.getElementById("admin-pass").value;
    const doc = await db.collection("config").doc("admin").get();
    if (doc.exists && doc.data().password === passInput) {
        document.getElementById("admin-login-view").style.display = "none";
        document.getElementById("admin-dashboard-view").style.display = "block";
        loadAdminInventory();
    } else { showToast("Clave incorrecta", "error"); }
}

function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach(c => c.style.display = "none");
    event.currentTarget.classList.add("active");
    document.getElementById(`tab-${tab}`).style.display = "block";
    if(tab === 'sales') loadAdminSales();
}

function loadAdminInventory() {
    const list = document.getElementById("admin-inventory-list");
    if(!list) return;
    list.innerHTML = products.map(p => `
        <div class="admin-item-row" style="display:flex; justify-content:space-between; margin-bottom:10px; background:#fff; padding:10px; border-radius:8px;">
            <span>${p.name} (S:${p.sizes.S} M:${p.sizes.M} L:${p.sizes.L})</span>
            <button onclick="deleteProduct('${p.id}')" style="color:red; border:none; background:none; cursor:pointer;">Eliminar</button>
        </div>
    `).join('');
}

async function deleteProduct(id) {
    if(confirm("¿Eliminar producto?")) await db.collection("products").doc(id).delete();
}

function loadAdminSales() {
    db.collection("orders").orderBy("date", "desc").onSnapshot(snapshot => {
        const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById("stat-total-sales").textContent = sales.length;
        const total = sales.reduce((acc, s) => acc + s.totalEur, 0);
        document.getElementById("stat-total-eur").textContent = `€ ${total.toFixed(2)}`;
        
        document.getElementById("admin-sales-list").innerHTML = sales.map(s => `
            <div class="admin-item-row" style="background:#fff; padding:10px; margin-bottom:5px; border-radius:8px;">
                <strong>${s.clientName}</strong> - € ${s.totalEur.toFixed(2)} [${s.paymentStatus}]
            </div>
        `).join('');
        populateManualSaleSelect();
    });
}

// --- FOTOS Y GUARDAR PRODUCTO ---
function previewImg(input, index) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { tempImages[index - 1] = e.target.result; };
    reader.readAsDataURL(file);
}

async function saveProduct(e) {
    e.preventDefault();
    const pData = {
        name: document.getElementById("prod-name").value,
        category: document.getElementById("prod-cat").value,
        price: parseFloat(document.getElementById("prod-price").value),
        images: tempImages,
        sizes: {
            S: parseInt(document.getElementById("stock-s").value) || 0,
            M: parseInt(document.getElementById("stock-m").value) || 0,
            L: parseInt(document.getElementById("stock-l").value) || 0
        }
    };
    await db.collection("products").add(pData);
    showToast("¡Producto Creado!");
    document.getElementById("product-form-box").style.display = "none";
    tempImages = ["", "", ""];
}

// --- UTILIDADES FINALES ---
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
