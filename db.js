const db = new Dexie('GastroManager');

db.version(1).stores({
  productos: '++id, nombre, categoria, precio, usaReceta',
  insumos: '++id, nombre, unidad, cantidad, minimo, precio',
  recetas: '++id, productoId, insumoId, cantidad',
  ventas: '++id, fecha, total',
  ventaItems: '++id, ventaId, productoId, cantidad, subtotal',
  gastos: '++id, fecha, descripcion, monto, categoria',
  pedidos: '++id, fechaEntrega, estado, cliente',
  movimientos: '++id, fecha, insumoId, tipo, cantidad, descripcion'
});

function hoy() { return new Date().toISOString().split('T')[0]; }
function ahora() { return new Date().toISOString(); }
function fmtGs(n) { return 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY'); }
function fmtFecha(f) {
  const d = new Date(f + 'T00:00:00');
  return d.toLocaleDateString('es-PY', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-PY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
const ESTADO_PEDIDO = {
  pendiente: { label: 'Pendiente', color: 'tag-yellow' },
  en_proceso: { label: 'En proceso', color: 'tag-green' },
  listo: { label: 'Listo', color: 'tag-green' },
  entregado: { label: 'Entregado', color: 'tag-green' },
  cancelado: { label: 'Cancelado', color: 'tag-red' }
};
let confirmCallback = null;
let lastVentaId = null;
let lastVentaItems = [];
