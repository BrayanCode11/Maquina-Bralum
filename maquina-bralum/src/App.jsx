import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Save, 
  Trash2, 
  ExternalLink, 
  TrendingUp,
  Package,
  ListFilter,
  Download,
  Target
} from 'lucide-react';

// Formateador de moneda colombiana
const formatCOP = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// --- Rango de precio Bralum efectivo ---
const BRALUM_PRICE_MIN = 70000;
const BRALUM_PRICE_MAX = 130000;

const parseGlobalSales = (ventasGlobales) => {
  if (!ventasGlobales) return null;
  const cleaned = String(ventasGlobales).replace(/[^\d]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const getGlobalFinancialValidation = ({ ventasGlobales, calificacion }) => {
  const rating = Number.parseFloat(String(calificacion).replace(',', '.'));
  const sales = parseGlobalSales(ventasGlobales);

  const qualityStatus = !Number.isNaN(rating)
    ? rating < 4.2
      ? { status: 'Descartar', message: 'Calidad menor a 4.2. ¡Ni lo mires!' }
      : rating <= 4.4
        ? { status: 'Condicional', message: 'Calidad 4.2 a 4.4. Requiere leer comentarios.' }
        : { status: 'Aprobar', message: 'Calidad 4.5+. Calidad Top.' }
    : null;

  const salesStatus = sales !== null
    ? sales < 1000
      ? { status: 'Condicional', message: 'Ventas < 1.000. Muy nuevo, riesgo de moda pasajera.' }
      : sales <= 9999
        ? { status: 'Aprobar', message: 'Ventas 1.000 a 9.999. Validado, pero no saturado. ¡Lanzar rápido!' }
        : { status: 'Aprobar', message: 'Ventas >= 10.000. Producto súper ganador.' }
    : null;

  if (qualityStatus?.status === 'Descartar') {
    return qualityStatus;
  }

  const statuses = [qualityStatus?.status, salesStatus?.status].filter(Boolean);

  if (statuses.includes('Descartar')) {
    return { status: 'Descartar', message: '🔴 Validación Financiera Global: Rechazado por calidad o ventas.' };
  }

  if (statuses.includes('Condicional')) {
    const parts = [qualityStatus?.message, salesStatus?.message].filter(Boolean);
    return {
      status: 'Condicional',
      message: `🟡 Validación Financiera Global:\n${parts.map(p => `  • ${p}`).join('\n')}`
    };
  }

  if (statuses.includes('Aprobar')) {
    const parts = [qualityStatus?.message, salesStatus?.message].filter(Boolean);
    return {
      status: 'Aprobar',
      message: `🟢 Validación Financiera Global:\n${parts.map(p => `  • ${p}`).join('\n')}`
    };
  }

  return {
    status: 'Pendiente',
    message: '⚪ Validación Financiera Global: Pendiente (sin datos).'
  };
};

const calculateMetrics = (precio, costo, flete, checkboxes, validacionMeta, ventasGlobales, calificacion) => {
  const margenBruto = precio - costo - flete;
  
  // Nivel de Margen
  let nivelMargen = "";
  if (margenBruto < 25000) nivelMargen = "🔴 Bajo (< $25k)";
  else if (margenBruto < 40000) nivelMargen = "🟡 Medio ($25k - $39k)";
  else nivelMargen = "🟢 Alto (+ $40k)";

  // Score Final
  const scoreFinal = 
    (checkboxes.efectoWow ? 1 : 0) + 
    (checkboxes.logisticaPce ? 1 : 0) + 
    (checkboxes.percepcionValor ? 1 : 0) + 
    (checkboxes.dificilAcceso ? 1 : 0);

  const validacionFinanciera = getGlobalFinancialValidation({ ventasGlobales, calificacion });

  // Veredicto Bralum 🤖
  let veredicto = "🔴 DESCARTADO (No pautar)";
  
  if (validacionFinanciera.status === 'Descartar') {
    veredicto = "🔴 DESCARTADO (Validación Financiera Global)";
  } else if (validacionMeta === 'Saturado') {
    veredicto = "🔴 DESCARTADO (Saturado en Meta)";
  } else if (margenBruto < 25000 || scoreFinal < 3) {
    veredicto = "🔴 DESCARTADO (No pautar)";
  } else if (validacionFinanciera.status === 'Condicional') {
    veredicto = "🟡 TESTEO CONDICIONADO (Validación Financiera Global)";
  } else if (margenBruto >= 40000 && scoreFinal >= 3) {
    if (validacionMeta === 'Ninguno') {
      veredicto = "🟡 TESTEO CONDICIONADO (Océano Azul / Riesgo)";
    } else {
      veredicto = "🟢 TESTEO PRIORITARIO (Lanzar hoy)";
    }
  } else if (margenBruto >= 25000 && scoreFinal === 4) {
    veredicto = "🟡 TESTEO CONDICIONADO (Armar Bundle)";
  } else {
    veredicto = "🟡 TESTEO CONDICIONADO (Verificación adicional)";
  }

  return { margenBruto, nivelMargen, scoreFinal, veredicto, validacionFinanciera: validacionFinanciera.message };
};

const INITIAL_FORM_STATE = {
  nombre: '',
  costoDropi: 0,
  precioBralum: 0,
  fletePromedio: 15000,
  efectoWow: false,
  logisticaPce: false,
  percepcionValor: false,
  dificilAcceso: false,
  linkDropi: '',
  validacionMeta: 'Pendiente',
  ventasGlobales: '',
  calificacion: ''
};

export default function BralumTester() {
  const [products, setProducts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [metrics, setMetrics] = useState({ 
    margenBruto: -15000, 
    nivelMargen: "🔴 Bajo (< $25k)", 
    scoreFinal: 0, 
    veredicto: "🔴 DESCARTADO (No pautar)",
    validacionFinanciera: '⚪ Validación Financiera Global: Pendiente de información.'
  });

  // Cargar datos al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('bralum_products');
    if (saved) {
      setProducts(JSON.parse(saved));
    }
  }, []);

  // Recalcular métricas cada vez que el formulario cambia
  useEffect(() => {
    const newMetrics = calculateMetrics(
      Number(form.precioBralum) || 0,
      Number(form.costoDropi) || 0,
      Number(form.fletePromedio) || 0,
      {
        efectoWow: form.efectoWow,
        logisticaPce: form.logisticaPce,
        percepcionValor: form.percepcionValor,
        dificilAcceso: form.dificilAcceso
      },
      form.validacionMeta,
      form.ventasGlobales,
      form.calificacion
    );
    setMetrics(newMetrics);
  }, [form]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveProduct = () => {
    if (!form.nombre) {
      alert("Por favor, ingresa el nombre del producto.");
      return;
    }

    const precioBralumValue = Number(form.precioBralum) || 0;
    if (precioBralumValue < BRALUM_PRICE_MIN || precioBralumValue > BRALUM_PRICE_MAX) {
      alert(`El Precio Bralum debe estar entre ${formatCOP(BRALUM_PRICE_MIN)} y ${formatCOP(BRALUM_PRICE_MAX)}.`);
      return;
    }

    const newProduct = {
      ...form,
      id: Date.now().toString(),
      ...metrics,
      ventasGlobales: form.ventasGlobales || '',
      calificacion: form.calificacion || '',
      fecha: new Date().toLocaleDateString()
    };
    
    const updatedProducts = [newProduct, ...products];
    setProducts(updatedProducts);
    localStorage.setItem('bralum_products', JSON.stringify(updatedProducts));
    
    // Reset form pero manteniendo el flete promedio en 15000
    setForm({...INITIAL_FORM_STATE, fletePromedio: 15000});
  };

  const handleDelete = (id) => {
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    localStorage.setItem('bralum_products', JSON.stringify(updatedProducts));
  };

  // Exportar a CSV (Excel)
  const exportToCSV = () => {
    // Usamos los productos filtrados o todos, según prefieras (aquí exportamos lo que se ve en pantalla)
    const dataToExport = activeFilter === 'Todos' ? products : filteredProducts;

    if (dataToExport.length === 0) {
      alert("No hay productos para exportar.");
      return;
    }

    const headers = [
      'Nombre', 'Costo Dropi (COP)', 'Precio Bralum (COP)', 
      'Flete (COP)', 'Margen Bruto (COP)', 'Ventas Globales', 'Calificación', 'Validación Financiera', 'Score Final', 'Meta Ads',
      'Veredicto', 'Link Dropi', 'Fecha Evaluación'
    ];

    const csvRows = [headers.join(',')];

    dataToExport.forEach(p => {
      const row = [
        `"${p.nombre.replace(/"/g, '""')}"`,
        p.costoDropi,
        p.precioBralum,
        p.fletePromedio,
        p.margenBruto,
        (p.ventasGlobales || ''),
        (p.calificacion || ''),        `"${p.validacionFinanciera || ''}"`,        p.scoreFinal,
        `"${p.validacionMeta}"`,
        `"${p.veredicto}"`,
        `"${p.linkDropi}"`,
        `"${p.fecha}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    // Añadir BOM para que Excel reconozca el UTF-8 (Tildes y eñes)
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bralum_BD_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Renderizadores de Badges
  const renderVeredictoBadge = (texto) => {
    if (texto.includes('🟢')) return <span className="bg-green-100 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm font-bold shadow-sm">{texto}</span>;
    if (texto.includes('🟡')) return <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-3 py-1 rounded-full text-sm font-bold shadow-sm">{texto}</span>;
    return <span className="bg-red-100 text-red-800 border border-red-200 px-3 py-1 rounded-full text-sm font-bold shadow-sm">{texto}</span>;
  };

  const renderMargenBadge = (texto) => {
    if (texto.includes('🟢')) return <span className="text-green-600 font-semibold">{texto}</span>;
    if (texto.includes('🟡')) return <span className="text-yellow-600 font-semibold">{texto}</span>;
    return <span className="text-red-600 font-semibold">{texto}</span>;
  };

  // Lógica de Filtrado
  const filteredProducts = products.filter(p => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Prioritario 🟢' && p.veredicto.includes('🟢')) return true;
    if (activeFilter === 'Condicionado 🟡' && p.veredicto.includes('🟡')) return true;
    if (activeFilter === 'Descartado 🔴' && p.veredicto.includes('🔴')) return true;
    return false;
  });

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Header */}
      <header className="w-full bg-slate-900 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Máquina de Testeo Bralum <span className="text-blue-400">4.0</span></h1>
              <p className="text-slate-400 text-sm">Sistema de evaluación y decisión de productos Dropshipping</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <Calculator className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-medium">Motor de Decisión Activo</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* PANEL IZQUIERDO: FORMULARIO */}
        <section className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-bold text-slate-800">Evaluador de Producto</h2>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Info Básica */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Producto</label>
                  <input type="text" name="nombre" value={form.nombre} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" placeholder="Ej: Cepillo Secador 5 en 1" />
                </div>
              </div>

              {/* Finanzas */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Estructura de Costos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Costo Dropi (COP)</label>
                    <input type="number" name="costoDropi" value={form.costoDropi || ''} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Precio Bralum (COP)</label>
                    <input
                      type="number"
                      name="precioBralum"
                      value={form.precioBralum || ''}
                      min={BRALUM_PRICE_MIN}
                      max={BRALUM_PRICE_MAX}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">Precio permitido: {formatCOP(BRALUM_PRICE_MIN)} - {formatCOP(BRALUM_PRICE_MAX)}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Flete Promedio (COP)</label>
                    <input type="number" name="fletePromedio" value={form.fletePromedio || ''} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* VALIDACIÓN FINANCIERA GLOBAL (AliExpress/Temu) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Validación Financiera Global (AliExpress/Temu)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ventas Globales</label>
                    <input type="text" name="ventasGlobales" value={form.ventasGlobales || ''} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="+10000" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Calificación</label>
                    <input type="number" name="calificacion" step="0.1" min="1" max="5" value={form.calificacion || ''} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="4.5" />
                    <p className="text-xs text-slate-500 mt-1">Ingrese valor entre 1.0 y 5.0</p>
                  </div>
                </div>
              </div>

              {/* Checkboxes de Calidad */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Criterios de Producto (Score)</h3>
                
                {[
                  { id: 'efectoWow', label: 'Efecto WOW (Atrapa atención rápido)' },
                  { id: 'logisticaPce', label: 'Logística PCE (Pequeño, Cuadrado, Económico envío)' },
                  { id: 'percepcionValor', label: 'Alta Percepción de Valor' },
                  { id: 'dificilAcceso', label: 'Difícil Acceso Físico (No se consigue en la tienda de la esquina)' }
                ].map(item => (
                  <label key={item.id} className="flex items-center p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox" 
                      name={item.id} 
                      checked={form[item.id]} 
                      onChange={handleInputChange} 
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer appearance-none border border-slate-300 bg-white checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="ml-3 text-sm font-medium text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Validación Meta Ads */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Validación en Meta Ads</h3>
                <select 
                  name="validacionMeta" 
                  value={form.validacionMeta} 
                  onChange={handleInputChange} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                >
                  <option value="Pendiente">⏳ Pendiente de revisión...</option>
                  <option value="Ninguno">🌊 0 Anuncios (Océano Azul - Riesgoso)</option>
                  <option value="Algunos">💰 Entre 3 y 20 Anuncios (Rentable)</option>
                  <option value="Saturado">📉 50+ Anuncios (Saturado, Evítalo)</option>
                </select>
              </div>

              {/* Enlaces */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Link Dropi</label>
                  <input type="url" name="linkDropi" value={form.linkDropi} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="https://dropi.co/..." />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* PANEL DERECHO: PANEL DE DECISIÓN Y BD */}
        <section className="xl:col-span-7 space-y-6">
          
          {/* PANEL DE DECISIÓN EN TIEMPO REAL */}
          <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
            <div className="p-6 sm:p-8">
              <h2 className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Veredicto en Tiempo Real
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                  <p className="text-slate-400 text-sm mb-1">Margen Bruto Calculado</p>
                  <p className={`text-3xl font-black tracking-tight ${metrics.margenBruto >= 40000 ? 'text-green-400' : metrics.margenBruto >= 25000 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {formatCOP(metrics.margenBruto)}
                  </p>
                  <p className="text-sm mt-2">{renderMargenBadge(metrics.nivelMargen)}</p>
                </div>
                
                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                  <p className="text-slate-400 text-sm mb-1">Score Final</p>
                  <div className="flex items-end gap-2">
                    <p className={`text-3xl font-black ${metrics.scoreFinal >= 3 ? 'text-blue-400' : 'text-slate-300'}`}>
                      {metrics.scoreFinal} <span className="text-lg text-slate-500 font-medium">/ 4</span>
                    </p>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {[1,2,3,4].map(star => (
                      <div key={star} className={`h-2 flex-1 rounded-full ${star <= metrics.scoreFinal ? 'bg-blue-500' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Veredicto Bralum 🤖</p>
                <div className="flex justify-center mb-4">
                  {renderVeredictoBadge(metrics.veredicto)}
                </div>
                
                {metrics.validacionFinanciera && (
                  <div className={`p-4 rounded-lg whitespace-pre-wrap text-xs font-semibold leading-relaxed break-words ${metrics.validacionFinanciera.includes('🔴') ? 'bg-red-500/10 text-red-400 border border-red-500/30' : metrics.validacionFinanciera.includes('🟡') ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30' : metrics.validacionFinanciera.includes('🟢') ? 'bg-green-500/10 text-green-300 border border-green-500/30' : 'bg-slate-500/10 text-slate-300 border border-slate-500/30'}`}>
                    {metrics.validacionFinanciera}
                  </div>
                )}
              </div>

              <button 
                onClick={handleSaveProduct}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Guardar Producto en Base de Datos
              </button>
            </div>
          </div>

          {/* BASE DE DATOS MAESTRA */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-800">Base de Datos de Productos</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full ml-2">{filteredProducts.length}</span>
              </div>
              
              {/* Botón de Exportación CSV */}
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Exportar a Excel
              </button>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap gap-2">
              {['Todos', 'Prioritario 🟢', 'Condicionado 🟡', 'Descartado 🔴'].map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeFilter === f 
                      ? 'bg-slate-800 text-white shadow-md scale-105' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No hay productos guardados en esta categoría.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="p-4 font-semibold">Producto</th>
                      <th className="p-4 font-semibold">Veredicto</th>
                      <th className="p-4 font-semibold">Margen Bruto</th>
                      <th className="p-4 font-semibold">Score</th>
                      <th className="p-4 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{p.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            {p.validacionMeta === 'Algunos' && '💰'}
                            {p.validacionMeta === 'Saturado' && '📉'}
                            {p.validacionMeta === 'Ninguno' && '🌊'}
                            {p.validacionMeta === 'Pendiente' && '⏳'}
                            {p.validacionMeta}
                          </p>
                        </td>
                        <td className="p-4">
                          {renderVeredictoBadge(p.veredicto)}
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-700">{formatCOP(p.margenBruto)}</p>
                          <p className="text-xs">{renderMargenBadge(p.nivelMargen)}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 font-bold text-slate-700">
                            {p.scoreFinal} / 4
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {p.linkDropi && (
                              <a href={p.linkDropi} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500" title="Ver en Dropi">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-red-500 p-1" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}