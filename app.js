// ==========================================
// ESTADO GLOBAL
// ==========================================
let products = [];
let cart = [];
let bcvRate = 0;
let selectedSize = null; // Para la talla seleccionada en el modal
let tempImages = ["", "", ""]; // Para las 3 fotos en el admin
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
    document.getElementById("open-admin-btn")?.addEventListener("click", () => {
        document.getElementById("admin-modal").classList.add("active");
    });
    
    // Filtros
    document.getElementById("search-input")?.addEventListener("input", filterProducts);
    document.getElementById("filter-category")?.addEventListener("change", filterProducts);
}

// --- TASA BCV ---
async function fetchBCVRate() {
    try {
        const doc = await db.collection("config").doc("rate").get();
        if (doc.exists) bcvRate = doc.data().bcv;
        else bcvRate = 36.5; 
        document.getElementById("bcv-rate-display").textContent = bcvRate.toFixed(2);
    } catch (e) { bcvRate = 36.5; }
}

// --- CARGAR PRODUCTOS ---
function loadProducts() {
    db.collection("products").onSnapshot(snapshot => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCatalog(products);
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
// MODAL DE PRODUCTO (GALERÍA + ZOOM + TALLAS)
// ==========================================
function openProductModal(id) {
    const p = products.find(prod => prod.id === id);
    selectedSize = null; 
    
    const modalBody = document.getElementById("modal-body-content");
    modalBody.innerHTML = `
        <div class="product-detail-layout">
            <div class="gallery-container">
                <div class="main-img-box">
                    <img src="${p.images[0]}" id="main-photo">
                </div>
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

                <button class="cta-button" onclick="addToCart('${p.id}')" style="width:100%">
                    Añadir al Carrito
                </button>
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
    if (!selectedSize) {
        showToast("⚠️ Por favor, elige una talla", "error");
        return;
    }
    const p = products.find(prod => prod.id === id);
    
    // El cartId es único para cada combinación producto+talla
    const cartItemId = id + "_" + selectedSize;
    const existing = cart.find(item => item.cartItemId === cartItemId);

    if (existing) {
        if (existing.qty < p.sizes[selectedSize]) existing.qty++;
        else { showToast("No hay más stock disponible"); return; }
    } else {
        cart.push({ ...p, selectedSize, cartItemId, qty: 1 });
    }
    
    updateCartUI();
    showToast("¡Añadido con éxito! ✨");
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
                <img src="${item.images[0]}" style="width:50px; border-radius:5px;">
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
// SEGURIDAD: LOGIN ADMIN DESDE FIRESTORE
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
        } else { showToast("Contraseña incorrecta", "error"); }
    } catch (err) { console.error(err); }
}

// --- ADMIN: GUARDAR PRODUCTO CON TALLAS Y 3 FOTOS ---
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
        images: tempImages, // Guarda el array de 3 fotos
        sizes: {
            S: parseInt(document.getElementById("stock-s").value) || 0,
            M: parseInt(document.getElementById("stock-m").value) || 0,
            L: parseInt(document.getElementById("stock-l").value) || 0
        }
    };
    await db.collection("products").add(pData);
    showToast("Producto Creado Correctamente");
    document.getElementById("product-form-box").style.display = "none";
}

// ==========================================
// UTILIDADES Y MODALES
// ==========================================
function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast show";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}

function filterProducts() {
    const search = document.getElementById("search-input").value.toLowerCase();
    const cat = document.getElementById("filter-category").value;
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(search) && (cat === "" || p.category === cat)
    );
    renderCatalog(filtered);
}

function openCart() { document.getElementById("cart-drawer").classList.add("active"); document.getElementById("cart-drawer-overlay").classList.add("active"); }
function closeCart() { document.getElementById("cart-drawer").classList.remove("active"); document.getElementById("cart-drawer-overlay").classList.remove("active"); }
function closeProductModal() { document.getElementById("product-modal").classList.remove("active"); }
function closeAdminModal() { document.getElementById("admin-modal").classList.remove("active"); }
function openProductForm() { document.getElementById("product-form-box").style.display = "block"; }
function adminLogout() { location.reload(); }
