// ==========================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
// Base de datos de productos inicial (se usa si no hay datos en localStorage)
const initialProducts = [
    {
        id: 1,
        name: "Vestido Romántico Rosa",
        category: "vestidos",
        price: 25.00,
        promoPrice: 19.99,
        isPromo: true, // Indica si el producto está en oferta
        stock: 5,
        image: "img/1001106409.jpg", // Ruta local por defecto
        description: "Vestido fresco con detalles florales y corte ajustado."
    },
    {
        id: 2,
        name: "Top Elegante Morado",
        category: "tops",
        price: 15.00,
        promoPrice: 0,
        isPromo: false,
        stock: 8,
        image: "img/1001106409.jpg",
        description: "Top casual de tela suave, ideal para salidas nocturnas."
    },
    {
        id: 3,
        name: "Falda Plisada Negra",
        category: "faldas",
        price: 20.00,
        promoPrice: 15.00,
        isPromo: true,
        stock: 3,
        image: "img/1001106409.jpg",
        description: "Falda corta plisada de tiro alto en color negro."
    }
];

// Cargar productos desde localStorage o usar los iniciales
let products = JSON.parse(localStorage.getItem('cosmica_products')) || initialProducts;

// Estado de la interfaz y persistencia
let cart = JSON.parse(localStorage.getItem('cosmica_cart')) || [];
let salesHistory = JSON.parse(localStorage.getItem('cosmica_sales')) || [];
let bcvRate = parseFloat(localStorage.getItem('cosmica_rate')) || 36.50; // Tasa por defecto si no hay guardada
let currentOrder = null;
const ADMIN_PASSWORD = "Fioremarie"; // Contraseña del panel

// Función para guardar datos en localStorage
function saveData() {
    localStorage.setItem('cosmica_products', JSON.stringify(products));
    localStorage.setItem('cosmica_cart', JSON.stringify(cart));
    localStorage.setItem('cosmica_sales', JSON.stringify(salesHistory));
    localStorage.setItem('cosmica_rate', bcvRate.toString());
}

// ==========================================
// 2. INICIALIZACIÓN Y EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Renderizado inicial
    renderProducts(products);
    setupEventListeners();
    updateCartCount();

    // Mostrar tasa BCV inicial
    const rateElems = document.querySelectorAll('#bcv-rate-display');
    rateElems.forEach(el => el.innerText = bcvRate.toFixed(2));
});

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

// ==========================================
// 3. CATÁLOGO DE PRODUCTOS (VISTA PÚBLICA)
// ==========================================
function renderProducts(productsToRender) {
    const container = document.getElementById('products-container');
    if (!container) return;

    if (productsToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 20px;">No se encontraron productos.</p>';
        return;
    }

    container.innerHTML = productsToRender.map(product => {
        // Lógica de precios
        const hasPromo = product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
        const activePrice = hasPromo ? product.promoPrice : product.price;

        return `
            <div class="product-card">
                <div class="product-img-box" onclick="openProductModal(${product.id})">
                    ${hasPromo ? '<span class="promo-badge">PROMO</span>' : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-img">
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
                            onclick="addToCart(${product.id})"
                            ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function applyFilters() {
    const search = document.getElementById('search-input')?.value.toLowerCase() || '';
    const category = document.getElementById('filter-category')?.value || '';
    const sort = document.getElementById('sort-by')?.value || 'default';

    let filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search);
        const matchesCategory = !category || p.category === category;
        return matchesSearch && matchesCategory;
    });

    // Ordenamiento
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
// 4. CARRITO DE COMPRAS (LOGICA Y VISTA)
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
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Precio a aplicar
    const finalPrice = (product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price) ? product.promoPrice : product.price;
    
    const cartItem = cart.find(item => item.id === productId);

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
    cart = cart.filter(item => item.id !== productId);
    saveData();
    updateCartCount();
    renderCart();
}

function changeCartQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    const product = products.find(p => p.id === productId);
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

    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
            <img src="${item.image}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover;">
            <div style="flex: 1;">
                <h5 style="margin: 0; font-size: 0.85rem; color: var(--morado-texto);">${item.name}</h5>
                <p style="margin: 2px 0; font-size: 0.8rem; color: var(--texto-suave);">€ ${item.price.toFixed(2)} x ${item.qty}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button onclick="changeCartQty(${item.id}, -1)" style="padding: 2px 6px; cursor:pointer;">-</button>
                <span style="font-size: 0.85rem; font-weight:bold; min-width:15px; text-align:center;">${item.qty}</span>
                <button onclick="changeCartQty(${item.id}, 1)" style="padding: 2px 6px; cursor:pointer;">+</button>
            </div>
            <button onclick="removeFromCart(${item.id})" style="border:none; background:none; color:#dc2626; cursor:pointer; font-size:1.2rem; margin-left:5px;">&times;</button>
        </div>
    `).join('');

    if (subtotalElem) subtotalElem.innerText = `€ ${totalEur.toFixed(2)}`;
    if (totalElem) totalElem.innerText = `€ ${totalEur.toFixed(2)}`;
}

// ==========================================
// 5. MODAL DE DETALLE DE PRODUCTO
// ==========================================
function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-body-content');
    if (!product || !modal || !content) return;

    const hasPromo = product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
    const activePrice = hasPromo ? product.promoPrice : product.price;

    content.innerHTML = `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <img src="${product.image}" style="width: 100%; max-width: 220px; height: 220px; border-radius: 12px; object-fit: cover; box-shadow: var(--sombra-card);">
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
                <p style="font-size:0.9rem; margin-bottom:5px;"><strong>Categoría:</strong> ${product.category.toUpperCase()}</p>
                <p style="font-size:0.9rem; margin-bottom:10px;"><strong>Disponible:</strong> ${product.stock} unidades</p>
                <p style="color: var(--texto-suave); margin: 15px 0; font-size:0.95rem;">${product.description}</p>
                <button class="cta-button" style="width: 100%;" onclick="addToCart(${product.id}); closeModal();" ${product.stock === 0 ? 'disabled' : ''}>
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
    
    // Resetear pasos
    document.getElementById('checkout-step-1').style.display = 'block';
    document.getElementById('checkout-step-2').style.display = 'none';
    document.getElementById('checkout-step-3').style.display = 'none';
    document.getElementById('checkout-step-4').style.display = 'none';

    // Calcular total
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
    
    // Generar número de pedido aleatorio
    const orderNum = 'COS-' + Math.floor(1000 + Math.random() * 9000);

    // Crear objeto del pedido actual
    currentOrder = { number: orderNum, clientName: name, phone: phone, totalEur: totalEur, items: [...cart] };

    // Descontar inventario real
    cart.forEach(cartItem => {
        const prod = products.find(p => p.id === cartItem.id);
        if (prod) prod.stock -= cartItem.qty;
    });

    // Guardar en historial de ventas (para el admin)
    salesHistory.push({
        number: orderNum,
        client: `${name} (${phone})`,
        itemsSummary: cart.map(i => `${i.name} x${i.qty}`).join(', '),
        totalEur: totalEur,
        date: new Date().toLocaleDateString()
    });

    // Vaciar carrito
    cart = [];
    saveData();
    updateCartCount();
    renderProducts(products); // Re-renderizar catálogo para actualizar stock visual

    // Actualizar vista de confirmación (Paso 2)
    document.getElementById('order-number-display').innerText = currentOrder.number;
    document.getElementById('summary-client-name').innerText = currentOrder.clientName;
    document.getElementById('summary-total-eur').innerText = `€ ${currentOrder.totalEur.toFixed(2)}`;

    // Cambiar de paso
    document.getElementById('checkout-step-1').style.display = 'none';
    document.getElementById('checkout-step-2').style.display = 'block';
}

function goToPaymentStep() {
    if (!currentOrder) return;
    
    // Calcular total en Bolívares
    const totalVes = currentOrder.totalEur * bcvRate;
    
    // Actualizar datos visuales del Paso 3
    document.getElementById('bcv-rate-display').innerText = bcvRate.toFixed(2);
    document.getElementById('checkout-total-ves').innerText = `${totalVes.toFixed(2)} Bs.`;

    // Cambiar de paso
    document.getElementById('checkout-step-2').style.display = 'none';
    document.getElementById('checkout-step-3').style.display = 'block';
}

function registerPayment(e) {
    e.preventDefault();
    if (!currentOrder) return;
    
    // Aquí iría la lógica para subir la foto del comprobante si tuvieras backend
    // Por ahora solo avanzamos al último paso
    
    document.getElementById('final-order-num').innerText = currentOrder.number;
    
    // Cambiar de paso final
    document.getElementById('checkout-step-3').style.display = 'none';
    document.getElementById('checkout-step-4').style.display = 'block';
}

// Funciones para WhatsApp
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
// 7. PANEL ADMINISTRADOR (LOGIN Y NAVEGACIÓN)
// ==========================================
function openAdminModal() {
    // Resetear vista al abrir
    document.getElementById('admin-login-view').style.display = 'block';
    document.getElementById('admin-dashboard-view').style.display = 'none';
    document.getElementById('admin-pass').value = '';
    document.getElementById('admin-modal').classList.add('active');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
    closeProductForm(); // Cerrar formulario si estaba abierto
}

function handleAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;

    if (pass === ADMIN_PASSWORD) {
        document.getElementById('admin-login-view').style.display = 'none';
        document.getElementById('admin-dashboard-view').style.display = 'block';
        
        // Cargar pestaña por defecto
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
    // Ocultar todos los contenidos y desactivar botones
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));

    // Mostrar pestaña seleccionada y activar botón
    document.getElementById(`tab-${tab}`).style.display = 'block';
    document.getElementById(`btn-tab-${tab}`).classList.add('active');

    // Carga de datos específica
    if (tab === 'products') {
        renderAdminInventory();
    } else if (tab === 'sales') {
        renderAdminSales();
    } else if (tab === 'rate') {
        document.getElementById('admin-rate-input').value = bcvRate;
    }
}

// ==========================================
// 8. GESTIÓN DE INVENTARIO (ADMIN) - CON SOPORTE DE GALERÍA
// ==========================================

// --- Funciones para manejo de imagen desde Galería ---

// 1. Convierte la foto elegida de la galería a Base64 y muestra la vista previa
function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Validar que sea imagen
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido.');
            clearProductImage();
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageDataUrl = e.target.result; // Cadena Base64
            
            // Guardar Base64 en el campo oculto
            document.getElementById('prod-img').value = imageDataUrl;
            
            // Mostrar vista previa
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

// 2. Limpia la imagen cargada del formulario
function clearProductImage() {
    const fileInput = document.getElementById('prod-img-file');
    const hiddenInput = document.getElementById('prod-img');
    const previewImg = document.getElementById('prod-img-preview');
    const previewContainer = document.getElementById('prod-img-preview-container');

    if (fileInput) fileInput.value = ''; // Limpiar selector de archivos
    if (hiddenInput) hiddenInput.value = ''; // Limpiar valor guardado
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
}

// --- CRUD de Productos ---

function renderAdminInventory() {
    const list = document.getElementById('admin-inventory-list');
    if (!list) return;

    if (products.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem; padding:10px;">No hay productos en inventario.</p>';
        return;
    }

    list.innerHTML = products.map(p => {
        const hasPromo = p.isPromo && p.promoPrice > 0;
        return `
            <div class="admin-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; gap:10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${p.image}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border:1px solid #eee;">
                    <div style="font-size: 0.85rem;">
                        <strong>${p.name}</strong> ${hasPromo ? '<span style="color:#e11d48; font-size:0.7rem; font-weight:bold; margin-left:3px;">[PROMO]</span>' : ''}<br>
                        <small style="color: var(--texto-suave);">€${p.price.toFixed(2)} | Stock: ${p.stock}</small>
                    </div>
                </div>
                <button onclick="openProductForm(${p.id})" style="padding: 5px 10px; font-size: 0.75rem; background: var(--morado-oscuro); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight:bold;">✏️ Editar</button>
            </div>
        `;
    }).join('');
}

function openProductForm(productId = null) {
    const box = document.getElementById('product-form-box');
    const title = document.getElementById('form-product-title');
    const btnDelete = document.getElementById('btn-delete-prod');
    const form = box.querySelector('form');

    // Resetear formulario e imagen previa
    form.reset();
    clearProductImage();

    if (productId) {
        // MODO EDICIÓN
        const p = products.find(item => item.id === productId);
        if (!p) return;

        title.innerText = '✏️ Editar Producto';
        btnDelete.style.display = 'inline-block';

        // Llenar campos
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-cat').value = p.category;
        document.getElementById('prod-stock').value = p.stock;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-promo-price').value = p.promoPrice || '';
        document.getElementById('prod-is-promo').checked = p.isPromo;
        
        // Cargar imagen existente en el campo oculto y vista previa
        if (p.image) {
            document.getElementById('prod-img').value = p.image;
            document.getElementById('prod-img-preview').src = p.image;
            document.getElementById('prod-img-preview-container').style.display = 'flex';
        }

    } else {
        // MODO CREACIÓN
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
    const cat = document.getElementById('prod-cat').value.trim().toLowerCase();
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const promoPrice = parseFloat(document.getElementById('prod-promo-price').value) || 0;
    const isPromo = document.getElementById('prod-is-promo').checked;
    
    // Obtener imagen del campo oculto (Base64 cargada o ruta existente)
    let image = document.getElementById('prod-img').value;
    
    // Imagen por defecto si no se cargó nada
    if (!image) {
        image = "img/1001106409.jpg"; 
    }

    if (id) {
        // Actualizar existente
        const index = products.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            products[index] = {
                ...products[index],
                name, category: cat, stock, price, promoPrice, isPromo, image
            };
        }
    } else {
        // Crear nuevo
        products.push({
            id: Date.now(), // ID único temporal
            name, category: cat, stock, price, promoPrice, isPromo, image,
            description: "Producto Cósmica ✨"
        });
    }

    saveData();
    renderProducts(products); // Actualizar vista pública
    renderAdminInventory(); // Actualizar lista admin
    closeProductForm();
    alert('¡Producto guardado con éxito! 💖');
}

function deleteCurrentProduct() {
    const idInput = document.getElementById('prod-id');
    if (!idInput.value) return;
    const id = parseInt(idInput.value);

    if (confirm('⚠️ ¿Estás segura de eliminar este producto permanentemente?')) {
        products = products.filter(p => p.id !== id);
        saveData();
        renderProducts(products);
        renderAdminInventory();
        closeProductForm();
    }
}

// ==========================================
// 9. HISTORIAL DE VENTAS Y TASA BCV (ADMIN)
// ==========================================
function renderAdminSales() {
    const list = document.getElementById('admin-sales-list');
    if (!list) return;

    const totalCount = salesHistory.length;
    const totalEur = salesHistory.reduce((acc, sale) => acc + sale.totalEur, 0);

    // Actualizar estadísticas
    document.getElementById('stat-total-sales').innerText = totalCount;
    document.getElementById('stat-total-eur').innerText = `€ ${totalEur.toFixed(2)}`;

    if (salesHistory.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.85rem; padding: 15px;">No hay ventas registradas.</p>';
        return;
    }

    list.innerHTML = salesHistory.map(sale => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; font-size: 0.8rem; gap:10px;">
            <div>
                <strong>Pedido: ${sale.number}</strong><br>
                <small style="color: var(--morado-principal);">${sale.date}</small>
            </div>
            <div style="text-align: right;">
                <span style="font-weight:bold; color:var(--morado-texto);">€ ${sale.totalEur.toFixed(2)}</span><br>
                <small style="color: var(--texto-suave); font-size:0.7rem;">${sale.client}</small>
            </div>
        </div>
    `).join('');
}

function saveManualRate() {
    const input = document.getElementById('admin-rate-input');
    const newRate = parseFloat(input.value);

    if (!isNaN(newRate) && newRate > 0) {
        bcvRate = newRate;
        saveData();
        // Actualizar displays
        document.querySelectorAll('#bcv-rate-display').forEach(el => el.innerText = bcvRate.toFixed(2));
        alert('Tasa BCV actualizada correctamente ✅.');
    } else {
        alert('Por favor ingresa una tasa válida.');
    }
}
// app.js - Actualiza estas funciones en la sección de Ventas Manuales

// ==========================================
// VENTAS MANUALES / PRESENCIALES - ACTUALIZADO
// ==========================================

// 1. Mostrar el formulario de venta manual (Se mantiene igual)
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
        option.value = p.id;
        const hasPromo = p.isPromo && p.promoPrice > 0;
        const activePrice = hasPromo ? p.promoPrice : p.price;
        option.innerText = `${p.name} - € ${activePrice.toFixed(2)} (Stock: ${p.stock})`;
        select.appendChild(option);
    });

    box.style.display = 'block';
    formManualSaleOpen = true; // Asegúrate de tener esta variable global declarada
}

// 2. Ocultar el formulario (Se mantiene igual)
function hideManualSaleForm() {
    const box = document.getElementById('manual-sale-form-box');
    if (box) {
        box.style.display = 'none';
        formManualSaleOpen = false;
        document.getElementById('manual-sale-form').reset();
    }
}

// 3. Registrar la venta manual - ACTUALIZADO para guardar estado de pago
function saveManualSale(e) {
    e.preventDefault();

    const select = document.getElementById('manual-prod-select');
    const qtyInput = document.getElementById('manual-qty');
    const clientInput = document.getElementById('manual-client');
    const paymentMethodInput = document.getElementById('manual-payment-method');
    // NUEVO CAMPO
    const paymentStatusInput = document.getElementById('manual-payment-status');

    const prodId = parseInt(select.value);
    const qty = parseInt(qtyInput.value) || 1;
    const clientName = clientInput.value.trim() || 'Venta Presencial';
    const paymentMethod = paymentMethodInput.value;
    // OBTENER NUEVO VALOR
    const paymentStatus = paymentStatusInput.value;

    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    if (qty > prod.stock) return alert(`Stock insuficiente ⚠️. Solo quedan ${prod.stock} unidades de ${prod.name}.`);

    // Descontar inventario
    prod.stock -= qty;

    const hasPromo = prod.isPromo && prod.promoPrice > 0;
    const activePrice = hasPromo ? prod.promoPrice : prod.price;
    const totalEur = activePrice * qty;
    
    // Generar número de pedido manual
    const orderNum = 'MAN-' + Math.floor(1000 + Math.random() * 9000);

    // Guardar en el historial CON ESTADO DE PAGO
    salesHistory.push({
        id: Date.now(), // ID único para poder eliminarlo luego
        number: orderNum,
        clientName: clientName,
        phone: 'Presencial',
        itemsSummary: `${prod.name} x${qty}`,
        totalEur: totalEur,
        method: paymentMethod,
        // NUEVO CAMPO
        paymentStatus: paymentStatus, 
        date: new Date().toLocaleDateString()
    });

    saveData(); // Persistir cambios
    renderProducts(products); // Actualizar vista pública
    renderAdminInventory(); // Actualizar lista admin
    renderAdminSales(); // Actualizar pestaña de ventas (Llama a la nueva versión)
    hideManualSaleForm();

    alert(`¡Venta externa registrada! Se descontaron ${qty} unidad(es) de ${prod.name}. El pedido es ${orderNum}. Cliente: ${clientName}. Total: € ${totalEur.toFixed(2)} pagado vía ${paymentMethod}. Estado: ${paymentStatus}.`);
}

// ==========================================
// RENDERIZADO Y ACCIONES DEL HISTORIAL DE VENTAS
// ==========================================

// 4. Renderizar el historial de ventas - ACTUALIZADO con badges y botones
function renderAdminSales() {
    const list = document.getElementById('admin-sales-list');
    if (!list) return;

    // Actualizar estadísticas (Se mantiene igual)
    const totalCount = salesHistory.length;
    const totalEur = salesHistory.reduce((acc, sale) => acc + sale.totalEur, 0);
    document.getElementById('stat-total-sales').innerText = totalCount;
    document.getElementById('stat-total-eur').innerText = `€ ${totalEur.toFixed(2)}`;

    if (salesHistory.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.85rem; margin-top: 15px;">No hay ventas registradas aún ✨.</p>';
        return;
    }

    // Invertimos la lista para mostrar las más nuevas primero
    const sortedSales = [...salesHistory].reverse();

    list.innerHTML = sortedSales.map(sale => {
        // Formatear estado de pago para el badge
        const statusClass = sale.paymentStatus === 'Pagado' ? 'pagado' : 'pendiente';
        const statusText = sale.paymentStatus === 'Pagado' ? '✅ Pagado' : '❌ Pendiente';

        return `
            <div class="sales-item-row admin-list-item" data-id="${sale.id}">
                <div class="sales-item-details">
                    <strong>Pedido: ${sale.number}</strong><br>
                    <small>${sale.clientName} | ${sale.itemsSummary}</small><br>
                    <small style="color: var(--morado-principal);">${sale.date} via ${sale.method}</small>
                </div>
                <div class="sales-item-actions">
                    <span class="payment-status-badge ${statusClass}">${statusText}</span>
                    <strong style="color: var(--morado-texto); font-size:1rem; margin: 0 10px;">€ ${sale.totalEur.toFixed(2)}</strong>
                    
                    <!-- BOTONES DE ACCIÓN NUEVOS -->
                    <button class="btn-action-sm btn-status-sale" title="Cambiar Estado de Pago" onclick="togglePaymentStatus(${sale.id})">🔄</button>
                    <button class="btn-action-sm btn-delete-sale" title="Eliminar Venta" onclick="deleteSale(${sale.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// 5. NUEVA FUNCIÓN: Eliminar una venta del historial
function deleteSale(saleId) {
    // Buscar la venta para confirmar
    const saleToDelete = salesHistory.find(sale => sale.id === saleId);
    if (!saleToDelete) return;

    if (confirm(`⚠️ ¿Estás segura de eliminar permanentemente la venta ${saleToDelete.number} del historial?`)) {
        // Eliminar del historial
        salesHistory = salesHistory.filter(sale => sale.id !== saleId);
        
        // Persistir cambios y re-renderizar
        saveData();
        renderAdminSales();
        alert('Venta eliminada del historial correctamente.');
    }
}

// 6. NUEVA FUNCIÓN: Cambiar estado de pago (Pendiente <-> Pagado)
function togglePaymentStatus(saleId) {
    const saleToUpdate = salesHistory.find(sale => sale.id === saleId);
    if (!saleToUpdate) return;

    // Cambiar estado
    saleToUpdate.paymentStatus = saleToUpdate.paymentStatus === 'Pagado' ? 'Pendiente' : 'Pagado';

    // Persistir cambios y re-renderizar
    saveData();
    renderAdminSales();
}
// Se ejecuta solo cuando hay cambios en la base de datos de Firebase
db.collection("productos").onSnapshot((snapshot) => {
    let productos = [];
    snapshot.forEach((doc) => {
        // Obtenemos los datos del producto junto con su ID único de Firebase
        productos.push({
            id: doc.id,
            ...doc.data()
        });
    });
    
    // AQUÍ llamas a la función que ya tenías para dibujar/renderizar las tarjetas de productos en el HTML
    // Por ejemplo: renderizarProductos(productos);
});
function guardarProductoFirebase(nuevoProducto) {
    // nuevoProducto debe ser un objeto con datos como: { nombre: "Pijama", precio: 25, imagen: "url..." }
    db.collection("productos").add(nuevoProducto)
        .then((docRef) => {
            console.log("Producto guardado exitosamente con ID:", docRef.id);
        })
        .catch((error) => {
            console.error("Error al guardar en Firebase:", error);
        });
} 
function eliminarProductoFirebase(idProducto) {
    db.collection("productos").doc(idProducto).delete()
        .then(() => {
            console.log("Producto eliminado correctamente");
        })
        .catch((error) => {
            console.error("Error al borrar:", error);
        });
}
