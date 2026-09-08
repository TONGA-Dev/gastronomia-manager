// ============ NAVEGACIÓN ============
let currentPage = 'dashboard';

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtns = document.querySelectorAll('.nav-btn');
  const pageMap = { dashboard:0, productos:1, inventario:2, pedidos:3, config:4 };
  if (pageMap[page] !== undefined) navBtns[pageMap[page]].classList.add('active');
  currentPage = page;
  if (page === 'dashboard') renderDashboard();
  if (page === 'productos') renderProductos();
  if (page === 'inventario') renderInventario();
  if (page === 'pedidos') renderPedidos();
  if (page === 'config') renderConfig();
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
  if (id === 'modal-producto') resetProductoForm();
  if (id === 'modal-insumo') resetInsumoForm();
  if (id === 'modal-pedido') resetPedidoForm();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function askConfirm(title, msg, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = callback;
  document.getElementById('modal-confirm').classList.add('active');
}

function confirmAction() {
  document.getElementById('modal-confirm').classList.remove('active');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
}

// ============ DASHBOARD ============
async function renderDashboard() {
  const hoyStr = hoy();
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-PY', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const ventasHoy = await db.ventas.where('fecha').equals(hoyStr).toArray();
  const totalVentas = ventasHoy.reduce((s,v) => s + (v.total || 0), 0);

  const gastosHoy = await db.gastos.where('fecha').equals(hoyStr).toArray();
  const totalGastos = gastosHoy.reduce((s,g) => s + (g.monto || 0), 0);

  const ganancia = totalVentas - totalGastos;

  document.getElementById('dash-ventas').textContent = fmtGs(totalVentas);
  document.getElementById('dash-gastos').textContent = fmtGs(totalGastos);
  document.getElementById('dash-ganancia').textContent = fmtGs(ganancia);
  document.getElementById('dash-ganancia').className = 'text-lg font-bold ' + (ganancia >= 0 ? 'text-teal-700' : 'text-red-600');

  const max = Math.max(totalVentas, totalGastos, 1);
  const pct = max > 0 ? Math.round((totalVentas / max) * 100) : 0;
  document.getElementById('dash-bar').style.width = pct + '%';

  // Pedidos pendientes
  const pedPendientes = await db.pedidos.where('estado').anyOf(['pendiente','en_proceso']).toArray();
  let pedHtml = '';
  if (pedPendientes.length > 0) {
    pedHtml = `<div class="card mb-4"><h3 class="font-semibold text-gray-800 mb-3">Pedidos Próximos</h3>`;
    pedPendientes.sort((a,b) => a.fechaEntrega.localeCompare(b.fechaEntrega)).slice(0,3).forEach(p => {
      const st = ESTADO_PEDIDO[p.estado] || {label:p.estado, color:'tag-gray'};
      pedHtml += `<div class="flex justify-between items-center py-2 border-b last:border-0">
        <span class="text-sm">${p.cliente} · ${fmtFecha(p.fechaEntrega)}</span>
        <span class="tag ${st.color}">${st.label}</span>
      </div>`;
    });
    pedHtml += '</div>';
  }

  // Low stock
  const insumos = await db.insumos.toArray();
  const low = insumos.filter(i => i.cantidad <= i.minimo);
  const lowHtml = low.length === 0
    ? '<p class="text-sm text-gray-400">Todo en orden</p>'
    : low.map(i => `<div class="flex justify-between items-center py-2 border-b last:border-0">
        <span class="text-sm">${i.nombre}</span>
        <span class="tag tag-red">${i.cantidad.toFixed(2)} ${i.unidad}</span>
      </div>`).join('');

  // Ventas recientes
  const recent = await db.ventas.reverse().limit(5).toArray();
  const recHtml = recent.length === 0
    ? '<p class="text-sm text-gray-400">Sin ventas aún</p>'
    : await Promise.all(recent.map(async v => {
        const items = await db.ventaItems.where('ventaId').equals(v.id).toArray();
        const count = items.reduce((s,it) => s + it.cantidad, 0);
        return `<div class="flex justify-between items-center py-2 border-b last:border-0">
          <span class="text-sm">${fmtDateTime(v.fecha + 'T' + (v.hora || '00:00'))}</span>
          <span class="font-semibold text-teal-700">${fmtGs(v.total)}</span>
        </div>`;
      })).then(arr => arr.join(''));

  const dashContainer = document.getElementById('page-dashboard').querySelector('.p-4');
  dashContainer.innerHTML = `
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="card text-center">
        <div class="text-2xl font-bold text-teal-700" id="dash-ventas">${fmtGs(totalVentas)}</div>
        <div class="text-xs text-gray-500">Ventas hoy</div>
      </div>
      <div class="card text-center">
        <div class="text-2xl font-bold text-red-600" id="dash-gastos">${fmtGs(totalGastos)}</div>
        <div class="text-xs text-gray-500">Gastos hoy</div>
      </div>
    </div>
    <div class="card mb-4">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-semibold text-gray-700">Ganancia Neta</span>
        <span class="text-lg font-bold ${ganancia >= 0 ? 'text-teal-700' : 'text-red-600'}">${fmtGs(ganancia)}</span>
      </div>
      <div class="chart-bar"><div class="chart-fill" style="width:${pct}%"></div></div>
    </div>
    ${pedHtml}
    <div class="card">
      <h3 class="font-semibold text-gray-800 mb-3">Productos con Bajo Stock</h3>
      <div id="dash-lowstock">${lowHtml}</div>
    </div>
    <div class="card mt-4">
      <h3 class="font-semibold text-gray-800 mb-3">Ventas Recientes</h3>
      <div id="dash-recent">${recHtml}</div>
    </div>
  `;
}

// ============ PRODUCTOS ============
async function renderProductos() {
  const q = (document.getElementById('search-productos')?.value || '').toLowerCase();
  let prods = await db.productos.toArray();
  if (q) prods = prods.filter(p => p.nombre.toLowerCase().includes(q));
  const container = document.getElementById('lista-productos');
  if (prods.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin productos. Toque + para agregar.</div>';
    return;
  }
  container.innerHTML = prods.map(p => {
    const catLabels = { torta:'Torta', bocadito:'Bocadito', almuerzo:'Almuerzo', cena:'Cena', postre:'Postre', otro:'Otro' };
    return `<div class="card">
      <div class="flex justify-between items-start">
        <div style="flex:1">
          <div class="font-semibold text-gray-800">${p.nombre}</div>
          <div class="text-xs text-gray-500 mt-1">${catLabels[p.categoria] || p.categoria}</div>
        </div>
        <div class="text-right" style="min-width:100px">
          <div class="font-bold text-teal-700">${fmtGs(p.precio)}</div>
          ${p.usaReceta ? '<span class="tag tag-green text-xs">Con receta</span>' : ''}
        </div>
      </div>
      <div class="flex gap-2 mt-3 pt-3 border-t">
        <button class="text-xs text-teal-700 font-semibold" onclick="event.stopPropagation(); verCostoReceta(${p.id})">💰 Costo</button>
        <button class="text-xs text-blue-600 font-semibold" onclick="event.stopPropagation(); editarProducto(${p.id})">✏️ Editar</button>
        <button class="text-xs text-red-600 font-semibold" onclick="event.stopPropagation(); eliminarProducto(${p.id})">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function resetProductoForm() {
  document.getElementById('prod-nombre').value = '';
  document.getElementById('prod-precio').value = '';
  document.getElementById('prod-categoria').value = 'torta';
  document.getElementById('prod-usa-receta').value = 'no';
  document.getElementById('receta-section').style.display = 'none';
  document.getElementById('receta-ingredientes').innerHTML = '';
}

function toggleReceta() {
  const val = document.getElementById('prod-usa-receta').value;
  document.getElementById('receta-section').style.display = val === 'si' ? 'block' : 'none';
  if (val === 'si' && document.getElementById('receta-ingredientes').children.length === 0) agregarIngredienteReceta();
}

async function agregarIngredienteReceta() {
  const insumos = await db.insumos.toArray();
  const container = document.getElementById('receta-ingredientes');
  const idx = container.children.length;
  if (insumos.length === 0) {
    container.innerHTML = '<p class="text-sm text-red-500 mb-2">Primero cree insumos en Inventario.</p>';
    return;
  }
  const opts = insumos.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`).join('');
  const div = document.createElement('div');
  div.className = 'ingredient-row';
  div.innerHTML = `
    <select class="flex-1" id="rec-ing-${idx}">${opts}</select>
    <input type="number" step="0.01" class="w-24" id="rec-cant-${idx}" placeholder="Cant.">
    <button type="button" class="remove-ingredient" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

async function guardarProducto() {
  const nombre = document.getElementById('prod-nombre').value.trim();
  const precio = parseFloat(document.getElementById('prod-precio').value) || 0;
  const categoria = document.getElementById('prod-categoria').value;
  const usaReceta = document.getElementById('prod-usa-receta').value === 'si';
  if (!nombre) { alert('Ingrese nombre del producto'); return; }

  const prodId = await db.productos.add({ nombre, precio, categoria, usaReceta });

  if (usaReceta) {
    const container = document.getElementById('receta-ingredientes');
    const rows = container.querySelectorAll('.ingredient-row');
    for (const row of rows) {
      const sel = row.querySelector('select');
      const inp = row.querySelector('input[type="number"]');
      const insumoId = parseInt(sel.value);
      const cantidad = parseFloat(inp.value) || 0;
      if (insumoId && cantidad > 0) await db.recetas.add({ productoId: prodId, insumoId, cantidad });
    }
  }

  closeModal('modal-producto');
  renderProductos();
}

async function editarProducto(id) {
  const p = await db.productos.get(id);
  if (!p) return;
  const nuevoNombre = prompt('Nombre del producto:', p.nombre);
  if (nuevoNombre === null) return;
  const nuevoPrecio = parseFloat(prompt('Precio de venta (Gs.):', p.precio));
  if (isNaN(nuevoPrecio)) return;
  await db.productos.update(id, { nombre: nuevoNombre.trim(), precio: nuevoPrecio });
  renderProductos();
}

async function eliminarProducto(id) {
  askConfirm('Eliminar Producto', '¿Eliminar este producto? También se borrará su receta.', async () => {
    await db.recetas.where('productoId').equals(id).delete();
    await db.productos.delete(id);
    renderProductos();
  });
}

async function verCostoReceta(id) {
  const p = await db.productos.get(id);
  if (!p) return;
  const recetas = await db.recetas.where('productoId').equals(id).toArray();
  if (recetas.length === 0) {
    document.getElementById('costo-content').innerHTML = '<p>Este producto no tiene receta configurada.</p>';
    openModal('modal-costo');
    return;
  }
  let totalCosto = 0;
  let html = '<table style="width:100%;font-size:14px;margin-bottom:16px;"><tr style="border-bottom:1px solid #e5e7eb;text-align:left;"><th>Insumo</th><th>Cant.</th><th>Unit.</th><th>Costo</th></tr>';
  for (const r of recetas) {
    const ins = await db.insumos.get(r.insumoId);
    if (ins) {
      const costoUnit = ins.precio || 0;
      const costoTotal = costoUnit * r.cantidad;
      totalCosto += costoTotal;
      html += `<tr style="border-bottom:1px solid #f3f4f6;"><td>${ins.nombre}</td><td>${r.cantidad} ${ins.unidad}</td><td>${fmtGs(costoUnit)}</td><td>${fmtGs(costoTotal)}</td></tr>`;
    }
  }
  html += '</table>';
  const margen = p.precio - totalCosto;
  const margenPct = p.precio > 0 ? Math.round((margen / p.precio) * 100) : 0;
  html += `
    <div class="card" style="margin-bottom:12px">
      <div class="flex justify-between"><span>Costo total:</span><span class="font-bold">${fmtGs(totalCosto)}</span></div>
      <div class="flex justify-between"><span>Precio venta:</span><span class="font-bold text-teal-700">${fmtGs(p.precio)}</span></div>
      <div class="flex justify-between"><span>Ganancia:</span><span class="font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}">${fmtGs(margen)}</span></div>
      <div class="flex justify-between"><span>Margen:</span><span class="font-bold">${margenPct}%</span></div>
    </div>`;
  document.getElementById('costo-content').innerHTML = html;
  openModal('modal-costo');
}

// ============ INVENTARIO ============
async function renderInventario() {
  const q = (document.getElementById('search-inventario')?.value || '').toLowerCase();
  let items = await db.insumos.toArray();
  if (q) items = items.filter(i => i.nombre.toLowerCase().includes(q));
  const container = document.getElementById('lista-inventario');
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin insumos. Toque + para agregar.</div>';
    return;
  }
  container.innerHTML = items.map(i => {
    const low = i.cantidad <= i.minimo;
    return `<div class="card">
      <div class="flex justify-between items-center">
        <div>
          <div class="font-semibold text-gray-800">${i.nombre}</div>
          <div class="text-xs text-gray-500 mt-1">Stock: ${i.cantidad.toFixed(2)} ${i.unidad} · Precio: ${fmtGs(i.precio || 0)}</div>
        </div>
        <div class="text-right">
          ${low ? '<span class="tag tag-red">BAJO</span>' : '<span class="tag tag-green">OK</span>'}
        </div>
      </div>
      <div class="flex gap-2 mt-3 pt-3 border-t">
        <button class="text-xs text-blue-600 font-semibold" onclick="editarInsumo(${i.id})">✏️ Stock</button>
        <button class="text-xs text-red-600 font-semibold" onclick="event.stopPropagation(); eliminarInsumo(${i.id})">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function resetInsumoForm() {
  document.getElementById('ins-nombre').value = '';
  document.getElementById('ins-unidad').value = 'kg';
  document.getElementById('ins-cantidad').value = '';
  document.getElementById('ins-minimo').value = '';
  document.getElementById('ins-precio').value = '';
}

async function guardarInsumo() {
  const nombre = document.getElementById('ins-nombre').value.trim();
  const unidad = document.getElementById('ins-unidad').value;
  const cantidad = parseFloat(document.getElementById('ins-cantidad').value) || 0;
  const minimo = parseFloat(document.getElementById('ins-minimo').value) || 0;
  const precio = parseFloat(document.getElementById('ins-precio').value) || 0;
  if (!nombre) { alert('Ingrese nombre del insumo'); return; }
  await db.insumos.add({ nombre, unidad, cantidad, minimo, precio });
  closeModal('modal-insumo');
  renderInventario();
}

async function editarInsumo(id) {
  const i = await db.insumos.get(id);
  if (!i) return;
  document.getElementById('ins-edit-id').value = id;
  document.getElementById('ins-edit-nombre').textContent = i.nombre + ' (' + i.unidad + ')';
  document.getElementById('ins-edit-cantidad').value = i.cantidad;
  openModal('modal-insumo-edit');
}

async function actualizarInsumo() {
  const id = parseInt(document.getElementById('ins-edit-id').value);
  const cantidad = parseFloat(document.getElementById('ins-edit-cantidad').value) || 0;
  const ins = await db.insumos.get(id);
  const diff = cantidad - ins.cantidad;
  await db.insumos.update(id, { cantidad });
  if (diff !== 0) {
    await db.movimientos.add({ fecha: hoy(), insumoId: id, tipo: diff > 0 ? 'ajuste_pos' : 'ajuste_neg', cantidad: Math.abs(diff), descripcion: 'Ajuste manual de stock' });
  }
  closeModal('modal-insumo-edit');
  renderInventario();
}

async function eliminarInsumo(id) {
  askConfirm('Eliminar Insumo', '¿Eliminar este insumo? Se perderá de todas las recetas.', async () => {
    await db.recetas.where('insumoId').equals(id).delete();
    await db.movimientos.where('insumoId').equals(id).delete();
    await db.insumos.delete(id);
    renderInventario();
  });
}

// ============ PEDIDOS ============
async function renderPedidos() {
  const pedidos = await db.pedidos.reverse().toArray();
  const container = document.getElementById('lista-pedidos');
  if (pedidos.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin pedidos. Toque + para agregar.</div>';
    return;
  }
  container.innerHTML = pedidos.map(p => {
    const st = ESTADO_PEDIDO[p.estado] || {label:p.estado, color:'tag-gray'};
    const prod = p.productoNombre || 'Sin producto';
    const saldo = (p.precio || 0) - (p.senia || 0);
    return `<div class="card">
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="font-semibold text-gray-800">${p.cliente}</div>
          <div class="text-xs text-gray-500">${prod} · ${fmtFecha(p.fechaEntrega)}</div>
        </div>
        <span class="tag ${st.color}">${st.label}</span>
      </div>
      <div class="flex justify-between text-sm mb-2">
        <span>Total: <span class="font-bold text-teal-700">${fmtGs(p.precio)}</span></span>
        <span>Seña: <span class="font-bold text-blue-600">${fmtGs(p.senia)}</span></span>
        <span>Saldo: <span class="font-bold ${saldo <= 0 ? 'text-green-600' : 'text-red-600'}">${fmtGs(saldo)}</span></span>
      </div>
      ${p.detalles ? `<div class="text-xs text-gray-500 mb-2 border-t pt-2">${p.detalles}</div>` : ''}
      <div class="flex gap-2 mt-2 pt-2 border-t">
        ${p.estado !== 'entregado' && p.estado !== 'cancelado' ? `
          <button class="text-xs text-teal-700 font-semibold" onclick="avanzarPedido(${p.id})">✅ Avanzar</button>
          <button class="text-xs text-blue-600 font-semibold" onclick="editarPedido(${p.id})">✏️ Editar</button>` : ''}
        <button class="text-xs text-red-600 font-semibold" onclick="eliminarPedido(${p.id})">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

async function resetPedidoForm() {
  document.getElementById('ped-cliente').value = '';
  document.getElementById('ped-telefono').value = '';
  document.getElementById('ped-cantidad').value = '1';
  document.getElementById('ped-precio').value = '';
  document.getElementById('ped-fecha-entrega').value = hoy();
  document.getElementById('ped-detalles').value = '';
  document.getElementById('ped-senia').value = '';
  const prods = await db.productos.toArray();
  document.getElementById('ped-producto').innerHTML = prods.map(p => `<option value="${p.id}" data-nombre="${p.nombre}">${p.nombre}</option>`).join('') || '<option value="">Sin productos</option>';
}

async function guardarPedido() {
  const cliente = document.getElementById('ped-cliente').value.trim();
  const telefono = document.getElementById('ped-telefono').value.trim();
  const productoId = parseInt(document.getElementById('ped-producto').value) || 0;
  const productoNombre = document.getElementById('ped-producto').options[document.getElementById('ped-producto').selectedIndex]?.dataset?.nombre || '';
  const cantidad = parseInt(document.getElementById('ped-cantidad').value) || 1;
  const precio = parseFloat(document.getElementById('ped-precio').value) || 0;
  const fechaEntrega = document.getElementById('ped-fecha-entrega').value;
  const detalles = document.getElementById('ped-detalles').value.trim();
  const senia = parseFloat(document.getElementById('ped-senia').value) || 0;

  if (!cliente) { alert('Ingrese nombre del cliente'); return; }
  if (!fechaEntrega) { alert('Ingrese fecha de entrega'); return; }

  await db.pedidos.add({
    cliente, telefono, productoId, productoNombre, cantidad, precio, fechaEntrega, detalles, senia,
    estado: 'pendiente', creado: ahora()
  });

  closeModal('modal-pedido');
  renderPedidos();
  renderDashboard();
}

async function avanzarPedido(id) {
  const p = await db.pedidos.get(id);
  if (!p) return;
  const flujo = ['pendiente', 'en_proceso', 'listo', 'entregado'];
  const idx = flujo.indexOf(p.estado);
  const nuevo = flujo[idx + 1] || p.estado;
  await db.pedidos.update(id, { estado: nuevo });
  renderPedidos();
  renderDashboard();
}

async function editarPedido(id) {
  const p = await db.pedidos.get(id);
  if (!p) return;
  const nuevoPrecio = parseFloat(prompt('Nuevo precio (Gs.):', p.precio));
  if (isNaN(nuevoPrecio)) return;
  const nuevaSenia = parseFloat(prompt('Seña actualizada (Gs.):', p.senia));
  if (isNaN(nuevaSenia)) return;
  await db.pedidos.update(id, { precio: nuevoPrecio, senia: nuevaSenia });
  renderPedidos();
}

async function eliminarPedido(id) {
  askConfirm('Eliminar Pedido', '¿Eliminar este pedido permanentemente?', async () => {
    await db.pedidos.delete(id);
    renderPedidos();
    renderDashboard();
  });
}

// ============ CONFIGURACIÓN / BACKUP ============
function renderConfig() {}

// ============ VENTAS ============
let ventaItemsCount = 0;

async function initVentas() {
  ventaItemsCount = 0;
  document.getElementById('venta-items').innerHTML = '';
  document.getElementById('venta-total').textContent = 'Gs. 0';
  agregarItemVenta();
  renderVentasHistorial();
}

async function agregarItemVenta() {
  const prods = await db.productos.toArray();
  const container = document.getElementById('venta-items');
  const idx = ventaItemsCount++;
  if (prods.length === 0) {
    container.innerHTML = '<p class="text-sm text-red-500">Primero cree productos.</p>';
    return;
  }
  const opts = prods.map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre} - ${fmtGs(p.precio)}</option>`).join('');
  const div = document.createElement('div');
  div.className = 'ingredient-row mb-2';
  div.dataset.idx = idx;
  div.innerHTML = `
    <select class="flex-1" id="vprod-${idx}" onchange="calcularTotalVenta()">${opts}</select>
    <input type="number" class="w-20" id="vcant-${idx}" value="1" min="1" onchange="calcularTotalVenta()">
    <button type="button" class="remove-ingredient" onclick="this.parentElement.remove(); calcularTotalVenta();">&times;</button>
  `;
  container.appendChild(div);
}

async function calcularTotalVenta() {
  let total = 0;
  const container = document.getElementById('venta-items');
  const rows = container.querySelectorAll('.ingredient-row');
  for (const row of rows) {
    const sel = row.querySelector('select');
    const inp = row.querySelector('input');
    const precio = parseFloat(sel.options[sel.selectedIndex]?.dataset?.precio || 0);
    const cant = parseInt(inp.value) || 0;
    total += precio * cant;
  }
  document.getElementById('venta-total').textContent = fmtGs(total);
}

async function registrarVenta() {
  const container = document.getElementById('venta-items');
  const rows = container.querySelectorAll('.ingredient-row');
  if (rows.length === 0) { alert('Agregue al menos un producto'); return; }

  askConfirm('Confirmar Venta', '¿Registrar esta venta y descontar del inventario?', async () => {
    const now = new Date();
    const fecha = hoy();
    const hora = now.toTimeString().slice(0,5);

    let total = 0;
    const items = [];

    for (const row of rows) {
      const sel = row.querySelector('select');
      const inp = row.querySelector('input');
      const productoId = parseInt(sel.value);
      const cantidad = parseInt(inp.value) || 0;
      const precio = parseFloat(sel.options[sel.selectedIndex]?.dataset?.precio || 0);
      const subtotal = precio * cantidad;
      total += subtotal;
      items.push({ productoId, cantidad, subtotal });
    }

    if (total === 0) { alert('El total no puede ser cero'); return; }

    // Descontar inventario por recetas
    for (const it of items) {
      const prod = await db.productos.get(it.productoId);
      if (prod && prod.usaReceta) {
        const recetas = await db.recetas.where('productoId').equals(it.productoId).toArray();
        for (const r of recetas) {
          const ins = await db.insumos.get(r.insumoId);
          if (ins) {
            const descuento = r.cantidad * it.cantidad;
            await db.insumos.update(r.insumoId, { cantidad: Math.max(0, ins.cantidad - descuento) });
            await db.movimientos.add({ fecha, insumoId: r.insumoId, tipo: 'venta', cantidad: descuento, descripcion: `Venta de ${prod.nombre}` });
          }
        }
      }
    }

    const ventaId = await db.ventas.add({ fecha, hora, total });
    for (const it of items) {
      await db.ventaItems.add({ ventaId, productoId: it.productoId, cantidad: it.cantidad, subtotal: it.subtotal });
    }

    initVentas();
    renderDashboard();
    alert('Venta registrada: ' + fmtGs(total));
  });
}

async function renderVentasHistorial() {
  const ventas = await db.ventas.reverse().limit(20).toArray();
  const container = document.getElementById('lista-ventas');
  if (ventas.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Sin ventas registradas</p>';
    return;
  }
  container.innerHTML = await Promise.all(ventas.map(async v => {
    const items = await db.ventaItems.where('ventaId').equals(v.id).toArray();
    const count = items.reduce((s,it) => s + it.cantidad, 0);
    return `<div class="list-item">
      <div>
        <div class="font-medium text-sm">${fmtDateTime(v.fecha + 'T' + (v.hora || '00:00'))}</div>
        <div class="text-xs text-gray-500">${count} producto(s)</div>
      </div>
      <div class="font-bold text-teal-700">${fmtGs(v.total)}</div>
    </div>`;
  })).then(arr => arr.join(''));
}

// ============ GASTOS ============
async function registrarGasto() {
  const descripcion = document.getElementById('gasto-desc').value.trim();
  const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
  const categoria = document.getElementById('gasto-categoria').value;
  if (!descripcion) { alert('Ingrese descripción'); return; }
  if (monto <= 0) { alert('Ingrese monto válido'); return; }

  await db.gastos.add({ fecha: hoy(), descripcion, monto, categoria });
  document.getElementById('gasto-desc').value = '';
  document.getElementById('gasto-monto').value = '';
  renderGastos();
  renderDashboard();
  alert('Gasto registrado');
}

async function renderGastos() {
  const gastos = await db.gastos.reverse().limit(30).toArray();
  const container = document.getElementById('lista-gastos');
  if (gastos.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Sin gastos registrados</p>';
    return;
  }
  const catLabels = { insumos:'Insumos', servicios:'Servicios', personal:'Personal', otros:'Otros' };
  container.innerHTML = gastos.map(g => `<div class="list-item">
    <div>
      <div class="font-medium text-sm">${g.descripcion}</div>
      <div class="text-xs text-gray-500">${fmtFecha(g.fecha)} · ${catLabels[g.categoria] || g.categoria}</div>
    </div>
    <div class="font-bold text-red-600">${fmtGs(g.monto)}</div>
  </div>`).join('');
}

async function exportarDatos() {
  const data = {
    version: 1,
    exportado: ahora(),
    productos: await db.productos.toArray(),
    insumos: await db.insumos.toArray(),
    recetas: await db.recetas.toArray(),
    ventas: await db.ventas.toArray(),
    ventaItems: await db.ventaItems.toArray(),
    gastos: await db.gastos.toArray(),
    pedidos: await db.pedidos.toArray(),
    movimientos: await db.movimientos.toArray()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gastro-backup-' + hoy() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function importarDatos(input) {
  const file = input.files[0];
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { alert('Archivo JSON inválido'); return; }

  askConfirm('Restaurar Datos', 'Esto REEMPLAZARÁ todos los datos actuales. ¿Continuar?', async () => {
    await db.delete();
    await db.open();

    if (data.productos) await db.productos.bulkAdd(data.productos);
    if (data.insumos) await db.insumos.bulkAdd(data.insumos);
    if (data.recetas) await db.recetas.bulkAdd(data.recetas);
    if (data.ventas) await db.ventas.bulkAdd(data.ventas);
    if (data.ventaItems) await db.ventaItems.bulkAdd(data.ventaItems);
    if (data.gastos) await db.gastos.bulkAdd(data.gastos);
    if (data.pedidos) await db.pedidos.bulkAdd(data.pedidos);
    if (data.movimientos) await db.movimientos.bulkAdd(data.movimientos);

    alert('Datos restaurados correctamente');
    renderDashboard();
    input.value = '';
  });
}

async function limpiarTodo() {
  askConfirm('⚠️ BORRAR TODO', 'ESTA ACCIÓN NO SE PUEDE DESHACER. ¿Eliminar todos los datos?', async () => {
    await db.delete();
    await db.open();
    alert('Todos los datos han sido eliminados');
    renderDashboard();
  });
}

// ============ INICIO ============
document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
});

window.onclick = function(e) {
  if (e.target.classList.contains('modal')) e.target.classList.remove('active');
};
