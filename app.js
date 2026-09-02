ahora el js // ==========================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
let products = [];
let cart = JSON.parse(localStorage.getItem('cosmica_cart')) || [];
let salesHistory = [];
let bcvRate = parseFloat(localStorage.getItem('cosmica_rate')) || 36.50;
let currentOrder = null;
const ADMIN_PASSWORD = "Fioremarie";

// Función global para normalizar textos (elimina tildes, mayúsculas y espacios)
function cleanText(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Guardar preferencia de tasa y carrito en localStorage
function saveData() {
    localStorage.setItem('cosmica_cart', JSON.stringify(cart));
    localStorage.setItem('cosmica_rate', bcvRate.toString());
}

// ==========================================
// 2. INICIALIZACIÓN Y EVENTOS DE FIREBASE
// ==========================================
function initApp() {
    // 1. Escuchar productos en tiempo real desde Firebase Firestore
    if (typeof db !== 'undefined') {
        db.collection("productos").onSnapshot((snapshot) => {
            products = [];
            snapshot.forEach((doc) => {
                products.push({
                    firestoreId: doc.id,
                    ...doc.data()
                });
            });

            // Renderizar catálogo y panel admin si estuviese abierto
            renderProducts(products);
            const adminInventoryList = document.getElementById('admin-inventory-list');
            if (adminInventoryList && adminInventoryList.offsetParent !== null) {
                renderAdminInventory();
            }
        }, (error) => {
            console.error("Error al escuchar productos en Firebase:", error);
        });

        // 2. Escuchar historial de ventas en tiempo real desde Firebase
        db.collection("ventas").onSnapshot((snapshot) => {
            salesHistory = [];
            snapshot.forEach((doc) => {
                salesHistory.push({
                    firestoreId: doc.id,
                    ...doc.data()
                });
            });
            
            const adminSalesList = document.getElementById('admin-sales-list');
            if (adminSalesList && adminSalesList.offsetParent !== null) {
                renderAdminSales();
            }
        });
    } else {
        console.error("Firebase DB no está inicializado. Verifica las etiquetas <script> de Firebase en index.html.");
    }

    setupEventListeners();
    setupCollectionClicks();
    updateCartCount();

    // Mostrar tasa BCV inicial
    const rateElems = document.querySelectorAll('#bcv-rate-display');
    rateElems.forEach(el => el.innerText = bcvRate.toFixed(2));
}

// Asegurar ejecución sin importar cómo o cuándo cargue el navegador (Móvil / Desktop)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function setupEventListeners() {
    // Filtros y Búsqueda
    document.getElementById('search-input')?.addEventListener('input', applyFilters);
    document.getElementById('filter-category')?.addEventListener('change', applyFilters);
    document.getElementById('sort-by')?.addEventListener('change', applyFilters);

    // Carrito (Drawer)
    document.getElementById('open-cart-btn')?.addEventListener('click', openCart);
    document.getElementById('close-cart-btn')?.addEventListener('click', closeCart);
    document.getElementById('cart-drawer-overlay')?.addEventListener('click', closeCart);
    
    // Modales generales
    document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('checkout-btn')?.addEventListener('click', openCheckout);
    document.getElementById('close-checkout-btn')?.addEventListener('click', closeCheckout);

    // Panel Administrador
    document.getElementById('open-admin-btn')?.addEventListener('click', openAdminModal);
}

// Escuchar clics en tarjetas de colección para filtrar y desplazar suavemente
function setupCollectionClicks() {
    const selector = ".category-card, .coleccion-card, .categoria-btn, [data-categoria]";
    const botonesColeccion = document.querySelectorAll(selector);

    botonesColeccion.forEach((boton) => {
        boton.style.cursor = "pointer";
        boton.addEventListener("click", () => {
            let catText = boton.dataset.categoria || boton.textContent.trim();
            filterByCategory(catText);

            // Desplazar suavemente hasta la sección de catálogo
            const catalogoSeccion = document.querySelector("#catalogo, .catalog-section, .catalogo, #productos");
            if (catalogoSeccion) {
                catalogoSeccion.scrollIntoView({ behavior: "smooth" });
            }
        });
    });
}

function filterByCategory(categoryName) {
    const cleanCat = cleanText(categoryName);
    
    // Sincronizar con el select de filtros
    const filterSelect = document.getElementById('filter-category');
    if (filterSelect) {
        for (let option of filterSelect.options) {
            if (cleanText(option.value) === cleanCat) {
                filterSelect.value = option.value;
                break;
            }
        }
    }

    if (!cleanCat) {
        renderProducts(products);
        return;
    }

    // Filtrar evaluando tanto 'category' como 'cat'
    const filtered = products.filter(p => {
        const prodCat = cleanText(p.category || p.cat);
        return prodCat === cleanCat;
    });

    renderProducts(filtered);
}

// ==========================================
// 3. CATÁLOGO DE PRODUCTOS (VISTA PÚBLICA)
// ==========================================
function renderProducts(productsToRender) {
    const container = document.getElementById('products-container');
    if (!container) return;

    if (productsToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 20px;">No se encontraron productos en la tienda.</p>';
        return;
    }

    container.innerHTML = productsToRender.map(product => {
        const hasPromo = product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
        const activePrice = hasPromo ? product.promoPrice : product.price;
        const prodId = product.firestoreId || product.id;

        return `
            <div class="product-card">
                <div class="product-img-box" onclick="openProductModal('${prodId}')">
                    ${hasPromo ? '<span class="promo-badge">PROMO</span>' : ''}
                    <img src="${product.image || 'img/1001106409.jpg'}" alt="${product.name}" class="product-img">
                </div>
                <div class="product-info">
                    <h4 class="product-title">${product.name}</h4>
                    <div class="price-box">
                        ${hasPromo ? `
                            <span class="old-price">€ ${product.price.toFixed(2)}</span>
                            <strong class="product-price" style="color: #e11d48;">€ ${activePrice.toFixed(2)}</strong>
                        ` : `
                            <strong class="product-price">€ ${product.price.toFixed(2)}</strong>
                        `}
                    </div>
                    <p style="font-size: 0.75rem; color: #666; margin: 0 0 10px 0;">Stock: ${product.stock}</p>
                    <button class="btn-add-cart" 
                            onclick="addToCart('${prodId}')"
                            ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function applyFilters() {
    const search = cleanText(document.getElementById('search-input')?.value);
    const category = cleanText(document.getElementById('filter-category')?.value);
    const sort = document.getElementById('sort-by')?.value || 'default';

    let filtered = products.filter(p => {
        const matchesSearch = cleanText(p.name).includes(search);
        const prodCat = cleanText(p.category || p.cat);
        const matchesCategory = !category || prodCat === category;
        return matchesSearch && matchesCategory;
    });

    if (sort === 'price-asc') {
        filtered.sort((a, b) => {
            const priceA = (a.isPromo && a.promoPrice) ? a.promoPrice : a.price;
            const priceB = (b.isPromo && b.promoPrice) ? b.promoPrice : b.price;
            return priceA - priceB;
        });
    } else if (sort === 'price-desc') {
        filtered.sort((a, b) => {
            const priceA = (a.isPromo && a.promoPrice) ? a.promoPrice : a.price;
            const priceB = (b.isPromo && b.promoPrice) ? b.promoPrice : b.price;
            return priceB - priceA;
        });
    }

    renderProducts(filtered);
}

// ==========================================
// 4. CARRITO DE COMPRAS
// ==========================================
function openCart() {
    document.getElementById('cart-drawer')?.classList.add('active');
    document.getElementById('cart-drawer-overlay')?.classList.add('active');
    renderCart();
}

function closeCart() {
    document.getElementById('cart-drawer')?.classList.remove('active');
    document.getElementById('cart-drawer-overlay')?.classList.remove('active');
}

function addToCart(productId) {
    const product = products.find(p => p.id == productId || p.firestoreId == productId);
    if (!product) return;

    const finalPrice = (product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price) ? product.promoPrice : product.price;
    const cartItem = cart.find(item => item.id == productId || item.firestoreId == productId);

    if (cartItem) {
        if (cartItem.qty + 1 > product.stock) {
            alert('Has alcanzado el límite de stock disponible para este artículo.');
            return;
        }
        cartItem.qty++;
    } else {
        if (product.stock < 1) {
            alert('Lo sentimos, este producto se encuentra agotado.');
            return;
        }
        cart.push({ ...product, price: finalPrice, qty: 1 });
    }

    saveData();
    updateCartCount();
    openCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId && item.firestoreId != productId);
    saveData();
    updateCartCount();
    renderCart();
}

function changeCartQty(productId, delta) {
    const item = cart.find(i => i.id == productId || i.firestoreId == productId);
    const product = products.find(p => p.id == productId || p.firestoreId == productId);
    if (!item || !product) return;

    const newQty = item.qty + delta;
    
    if (newQty <= 0) {
        removeFromCart(productId);
    } else if (newQty > product.stock) {
        alert('No hay más stock disponible para este producto.');
    } else {
        item.qty = newQty;
        saveData();
        renderCart();
        updateCartCount();
    }
}

function updateCartCount() {
    const totalCount = cart.reduce((acc, item) => acc + item.qty, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = totalCount;
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const subtotalElem = document.getElementById('cart-subtotal');
    const totalElem = document.getElementById('cart-total');

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888; padding:30px 0;">Tu carrito está vacío ✨</p>';
        if (subtotalElem) subtotalElem.innerText = '€ 0.00';
        if (totalElem) totalElem.innerText = '€ 0.00';
        return;
    }

    const totalEur = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    container.innerHTML = cart.map(item => {
        const idVal = item.firestoreId || item.id;
        return `
            <div class="cart-item" style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                <img src="${item.image || 'img/1001106409.jpg'}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover;">
                <div style="flex: 1;">
                    <h5 style="margin: 0; font-size: 0.85rem; color: var(--morado-texto);">${item.name}</h5>
                    <p style="margin: 2px 0; font-size: 0.8rem; color: var(--texto-suave);">€ ${item.price.toFixed(2)} x ${item.qty}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button onclick="changeCartQty('${idVal}', -1)" style="padding: 2px 6px; cursor:pointer;">-</button>
                    <span style="font-size: 0.85rem; font-weight:bold; min-width:15px; text-align:center;">${item.qty}</span>
                    <button onclick="changeCartQty('${idVal}', 1)" style="padding: 2px 6px; cursor:pointer;">+</button>
                </div>
                <button onclick="removeFromCart('${idVal}')" style="border:none; background:none; color:#dc2626; cursor:pointer; font-size:1.2rem; margin-left:5px;">&times;</button>
            </div>
        `;
    }).join('');

    if (subtotalElem) subtotalElem.innerText = `€ ${totalEur.toFixed(2)}`;
    if (totalElem) totalElem.innerText = `€ ${totalEur.toFixed(2)}`;
}

// ==========================================
// 5. MODAL DE DETALLE DE PRODUCTO
// ==========================================
function openProductModal(productId) {
    const product = products.find(p => p.id == productId || p.firestoreId == productId);
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-body-content');
    if (!product || !modal || !content) return;

    const hasPromo = product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
    const activePrice = hasPromo ? product.promoPrice : product.price;
    const idVal = product.firestoreId || product.id;

    content.innerHTML = `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <img src="${product.image || 'img/1001106409.jpg'}" style="width: 100%; max-width: 220px; height: 220px; border-radius: 12px; object-fit: cover; box-shadow: var(--sombra-card);">
            <div style="flex: 1; min-width: 200px;">
                <h3 style="margin-top:0; color: var(--morado-texto);">${product.name}</h3>
                <div style="margin: 10px 0;">
                    ${hasPromo ? `
                        <span style="text-decoration: line-through; color: var(--texto-suave); margin-right: 8px;">€ ${product.price.toFixed(2)}</span>
                        <strong style="font-size: 1.4rem; color: #e11d48;">€ ${activePrice.toFixed(2)} <span style="font-size:0.8rem;">(OFERTA)</span></strong>
                    ` : `
                        <strong style="font-size: 1.4rem; color: var(--morado-principal);">€ ${product.price.toFixed(2)}</strong>
                    `}
                </div>
                <p style="font-size:0.9rem; margin-bottom:5px;"><strong>Categoría:</strong> ${((product.category || product.cat) || '').toUpperCase()}</p>
                <p style="font-size:0.9rem; margin-bottom:10px;"><strong>Disponible:</strong> ${product.stock} unidades</p>
                <p style="color: var(--texto-suave); margin: 15px 0; font-size:0.95rem;">${product.description || 'Producto Cósmica ✨'}</p>
                <button class="cta-button" style="width: 100%;" onclick="addToCart('${idVal}'); closeModal();" ${product.stock === 0 ? 'disabled' : ''}>
                    ${product.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('active');
}

// ==========================================
// 6. FLUJO DE CHECKOUT Y PAGO (PÚBLICO)
// ==========================================
function openCheckout() {
    if (cart.length === 0) return alert('Tu carrito está vacío.');
    closeCart();
    
    document.getElementById('checkout-step-1').style.display = 'block';
    document.getElementById('checkout-step-2').style.display = 'none';
    document.getElementById('checkout-step-3').style.display = 'none';
    document.getElementById('checkout-step-4').style.display = 'none';

    const totalEur = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalEurElem = document.getElementById('checkout-total-eur');
    if (totalEurElem) totalEurElem.innerText = `€ ${totalEur.toFixed(2)}`;

    document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
}

function processOrder(e) {
    e.preventDefault();
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const totalEur = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    const orderNum = 'COS-' + Math.floor(1000 + Math.random() * 9000);
    currentOrder = { number: orderNum, clientName: name, phone: phone, totalEur: totalEur, items: [...cart] };

    // Descontar inventario en Firebase Firestore
    cart.forEach(cartItem => {
        const prod = products.find(p => p.id == cartItem.id || p.firestoreId == cartItem.firestoreId);
        if (prod && prod.firestoreId) {
            const newStock = Math.max(0, prod.stock - cartItem.qty);
            db.collection("productos").doc(prod.firestoreId).update({ stock: newStock });
        }
    });

    // Guardar venta en Firebase Firestore
    db.collection("ventas").add({
        number: orderNum,
        clientName: `${name} (${phone})`,
        itemsSummary: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        totalEur: totalEur,
        method: 'Web',
        paymentStatus: 'Pendiente',
        date: new Date().toLocaleDateString()
    });

    // Vaciar carrito
    cart = [];
    saveData();
    updateCartCount();

    document.getElementById('order-number-display').innerText = currentOrder.number;
    document.getElementById('summary-client-name').innerText = currentOrder.clientName;
    document.getElementById('summary-total-eur').innerText = `€ ${currentOrder.totalEur.toFixed(2)}`;

    document.getElementById('checkout-step-1').style.display = 'none';
    document.getElementById('checkout-step-2').style.display = 'block';
}

function goToPaymentStep() {
    if (!currentOrder) return;
    const totalVes = currentOrder.totalEur * bcvRate;
    document.getElementById('bcv-rate-display').innerText = bcvRate.toFixed(2);
    document.getElementById('checkout-total-ves').innerText = `${totalVes.toFixed(2)} Bs.`;

    document.getElementById('checkout-step-2').style.display = 'none';
    document.getElementById('checkout-step-3').style.display = 'block';
}

function registerPayment(e) {
    e.preventDefault();
    if (!currentOrder) return;
    document.getElementById('final-order-num').innerText = currentOrder.number;
    document.getElementById('checkout-step-3').style.display = 'none';
    document.getElementById('checkout-step-4').style.display = 'block';
}

function sendWhatsAppSummary() {
    if (!currentOrder) return;
    const msg = `Hola CÓSMICA ✨, reporto el pago de mi pedido *${currentOrder.number}* a nombre de *${currentOrder.clientName}* por un total de *€ ${currentOrder.totalEur.toFixed(2)}*.`;
    window.open(`https://wa.me/584221727585?text=${encodeURIComponent(msg)}`, '_blank');
}

function sendDirectPaymentWhatsApp() {
    if (!currentOrder) return;
    const msg = `Hola CÓSMICA ✨, quiero acordar el pago de mi pedido *${currentOrder.number}* a nombre de *${currentOrder.clientName}*. Total: *€ ${currentOrder.totalEur.toFixed(2)}*.`;
    window.open(`https://wa.me/584221727585?text=${encodeURIComponent(msg)}`, '_blank');
}

// ==========================================
// 7. PANEL ADMINISTRADOR
// ==========================================
function openAdminModal() {
    document.getElementById('admin-login-view').style.display = 'block';
    document.getElementById('admin-dashboard-view').style.display = 'none';
    document.getElementById('admin-pass').value = '';
    document.getElementById('admin-modal').classList.add('active');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
    closeProductForm();
}

function handleAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;

    if (pass === ADMIN_PASSWORD) {
        document.getElementById('admin-login-view').style.display = 'none';
        document.getElementById('admin-dashboard-view').style.display = 'block';
        switchAdminTab('products');
    } else {
        alert('Contraseña incorrecta 🔐.');
    }
}

function adminLogout() {
    document.getElementById('admin-dashboard-view').style.display = 'none';
    document.getElementById('admin-login-view').style.display = 'block';
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tab}`).style.display = 'block';
    document.getElementById(`btn-tab-${tab}`).classList.add('active');

    if (tab === 'products') {
        renderAdminInventory();
    } else if (tab === 'sales') {
        renderAdminSales();
    } else if (tab === 'rate') {
        document.getElementById('admin-rate-input').value = bcvRate;
    }
}

// ==========================================
// 8. GESTIÓN DE INVENTARIO (ADMIN CON FIREBASE)
// ==========================================
function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido.');
            clearProductImage();
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageDataUrl = e.target.result;
            document.getElementById('prod-img').value = imageDataUrl;
            const previewImg = document.getElementById('prod-img-preview');
            const previewContainer = document.getElementById('prod-img-preview-container');
            if (previewImg && previewContainer) {
                previewImg.src = imageDataUrl;
                previewContainer.style.display = 'flex';
            }
        };
        reader.readAsDataURL(file);
    }
}

function clearProductImage() {
    const fileInput = document.getElementById('prod-img-file');
    const hiddenInput = document.getElementById('prod-img');
    const previewImg = document.getElementById('prod-img-preview');
    const previewContainer = document.getElementById('prod-img-preview-container');

    if (fileInput) fileInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
}

function renderAdminInventory() {
    const list = document.getElementById('admin-inventory-list');
    if (!list) return;

    if (products.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem; padding:10px;">No hay productos en inventario.</p>';
        return;
    }

    list.innerHTML = products.map(p => {
        const hasPromo = p.isPromo && p.promoPrice > 0;
        const idVal = p.firestoreId || p.id;
        return `
            <div class="admin-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; gap:10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${p.image || 'img/1001106409.jpg'}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border:1px solid #eee;">
                    <div style="font-size: 0.85rem;">
                        <strong>${p.name}</strong> ${hasPromo ? '<span style="color:#e11d48; font-size:0.7rem; font-weight:bold; margin-left:3px;">[PROMO]</span>' : ''}<br>
                        <small style="color: var(--texto-suave);">€${p.price.toFixed(2)} | Stock: ${p.stock}</small>
                    </div>
                </div>
                <button onclick="openProductForm('${idVal}')" style="padding: 5px 10px; font-size: 0.75rem; background: var(--morado-oscuro); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight:bold;">✏️ Editar</button>
            </div>
        `;
    }).join('');
}

function openProductForm(productId = null) {
    const box = document.getElementById('product-form-box');
    const title = document.getElementById('form-product-title');
    const btnDelete = document.getElementById('btn-delete-prod');
    const form = box.querySelector('form');

    form.reset();
    clearProductImage();

    if (productId) {
        const p = products.find(item => item.id == productId || item.firestoreId == productId);
        if (!p) return;

        title.innerText = '✏️ Editar Producto';
        btnDelete.style.display = 'inline-block';

        document.getElementById('prod-id').value = p.firestoreId || p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-cat').value = cleanText(p.category || p.cat) || 'pijamas';
        document.getElementById('prod-stock').value = p.stock;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-promo-price').value = p.promoPrice || '';
        document.getElementById('prod-is-promo').checked = p.isPromo;
        
        if (p.image) {
            document.getElementById('prod-img').value = p.image;
            document.getElementById('prod-img-preview').src = p.image;
            document.getElementById('prod-img-preview-container').style.display = 'flex';
        }

    } else {
        title.innerText = '➕ Nuevo Producto';
        btnDelete.style.display = 'none';
        document.getElementById('prod-id').value = '';
    }

    box.style.display = 'block';
}

function closeProductForm() {
    const box = document.getElementById('product-form-box');
    if (box) box.style.display = 'none';
}

function saveProduct(e) {
    e.preventDefault();

    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const cat = cleanText(document.getElementById('prod-cat').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const promoPrice = parseFloat(document.getElementById('prod-promo-price').value) || 0;
    const isPromo = document.getElementById('prod-is-promo').checked;
    
    let image = document.getElementById('prod-img').value;
    if (!image) {
        image = "img/1001106409.jpg"; 
    }

    const productData = {
        name,
        category: cat,
        stock,
        price,
        promoPrice,
        isPromo,
        image,
        description: "Producto Cósmica ✨"
    };

    if (id) {
        // Actualizar en Firebase Firestore
        db.collection("productos").doc(id).update(productData)
            .then(() => alert('¡Producto actualizado en Firebase! 💖'))
            .catch(error => console.error("Error actualizando producto:", error));
    } else {
        // Crear en Firebase Firestore
        db.collection("productos").add(productData)
            .then(() => alert('¡Producto agregado con éxito a la nube! 💖'))
            .catch(error => console.error("Error agregando producto:", error));
    }

    closeProductForm();
}

function deleteCurrentProduct() {
    const idInput = document.getElementById('prod-id');
    if (!idInput.value) return;
    const id = idInput.value;

    if (confirm('⚠️ ¿Estás segura de eliminar este producto permanentemente de la nube?')) {
        db.collection("productos").doc(id).delete()
            .then(() => {
                closeProductForm();
                alert('Producto eliminado exitosamente');
            })
            .catch(error => console.error("Error al eliminar producto:", error));
    }
}

// ==========================================
// 9. HISTORIAL DE VENTAS Y TASA BCV
// ==========================================
function openManualSaleForm() {
    if (products.length === 0) {
        alert("No hay productos en inventario para vender 📦.");
        return;
    }

    const select = document.getElementById('manual-prod-select');
    const box = document.getElementById('manual-sale-form-box');
    if (!select || !box) return;

    select.innerHTML = '<option value="">Selecciona un producto</option>';
    
    products.filter(p => p.stock > 0).forEach(p => {
        const option = document.createElement('option');
        const idVal = p.firestoreId || p.id;
        option.value = idVal;
        const hasPromo = p.isPromo && p.promoPrice > 0;
        const activePrice = hasPromo ? p.promoPrice : p.price;
        option.innerText = `${p.name} - € ${activePrice.toFixed(2)} (Stock: ${p.stock})`;
        select.appendChild(option);
    });

    box.style.display = 'block';
}

function hideManualSaleForm() {
    const box = document.getElementById('manual-sale-form-box');
    if (box) {
        box.style.display = 'none';
        document.getElementById('manual-sale-form').reset();
    }
}

function saveManualSale(e) {
    e.preventDefault();

    const select = document.getElementById('manual-prod-select');
    const qtyInput = document.getElementById('manual-qty');
    const clientInput = document.getElementById('manual-client');
    const paymentMethodInput = document.getElementById('manual-payment-method');
    const paymentStatusInput = document.getElementById('manual-payment-status');

    const prodId = select.value;
    const qty = parseInt(qtyInput.value) || 1;
    const clientName = clientInput.value.trim() || 'Venta Presencial';
    const paymentMethod = paymentMethodInput.value;
    const paymentStatus = paymentStatusInput.value;

    const prod = products.find(p => p.id == prodId || p.firestoreId == prodId);
    if (!prod) return;

    if (qty > prod.stock) return alert(`Stock insuficiente ⚠️. Solo quedan ${prod.stock} unidades de ${prod.name}.`);

    // Descontar inventario en Firebase Firestore
    if (prod.firestoreId) {
        db.collection("productos").doc(prod.firestoreId).update({
            stock: Math.max(0, prod.stock - qty)
        });
    }

    const hasPromo = prod.isPromo && prod.promoPrice > 0;
    const activePrice = hasPromo ? prod.promoPrice : prod.price;
    const totalEur = activePrice * qty;
    const orderNum = 'MAN-' + Math.floor(1000 + Math.random() * 9000);

    // Guardar venta en Firebase
    db.collection("ventas").add({
        number: orderNum,
        clientName: clientName,
        itemsSummary: `${prod.name} x${qty}`,
        totalEur: totalEur,
        method: paymentMethod,
        paymentStatus: paymentStatus,
        date: new Date().toLocaleDateString()
    }).then(() => {
        hideManualSaleForm();
        alert(`¡Venta externa registrada! Se descontaron ${qty} unidad(es) de ${prod.name}.`);
    });
}

function renderAdminSales() {
    const list = document.getElementById('admin-sales-list');
    if (!list) return;

    const totalCount = salesHistory.length;
    const totalEur = salesHistory.reduce((acc, sale) => acc + (sale.totalEur || 0), 0);
    document.getElementById('stat-total-sales').innerText
    }).join('');
}
