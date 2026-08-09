import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Layers, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Download, 
  Upload, 
  Info,
  Flame
} from 'lucide-react';
import { MaterialCatalog, MaterialOption } from '../types/hvac';
import { defaultMaterialService } from '../services/materialService';

interface MaterialManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCatalogUpdate: () => void;
}

export const MaterialManagerModal: React.FC<MaterialManagerModalProps> = ({
  isOpen,
  onClose,
  onCatalogUpdate
}) => {
  const [catalog, setCatalog] = useState<MaterialCatalog | null>(null);
  const [activeCategory, setActiveCategory] = useState<'paredes' | 'telhados' | 'vidros'>('paredes');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<'paredes' | 'telhados' | 'vidros'>('paredes');
  const [name, setName] = useState<string>('');
  const [uFactor, setUFactor] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await defaultMaterialService.getCatalog();
      setCatalog(data);
    } catch (err) {
      setNotification({ type: 'error', text: 'Erro ao carregar catálogo de materiais.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  // Filtered materials based on category and search query
  const filteredMaterials = useMemo(() => {
    if (!catalog || !catalog[activeCategory]) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalog[activeCategory];
    return catalog[activeCategory].filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.description.toLowerCase().includes(q) ||
      m.uFactor.toString().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  }, [catalog, activeCategory, searchQuery]);

  if (!isOpen) return null;

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Por favor, informe o nome do material.');
      return;
    }
    const valU = parseFloat(uFactor);
    if (isNaN(valU) || valU <= 0) {
      showToast('error', 'Informe um Fator U (transmitância) válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const idSanitized = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      const newOption: MaterialOption = {
        id: `custom_${Date.now()}_${idSanitized}`,
        name: name.trim(),
        uFactor: valU,
        description: description.trim() || 'Material personalizado cadastrado no sistema.'
      };

      const updatedCatalog = await defaultMaterialService.addMaterial(formCategory, newOption);
      setCatalog(updatedCatalog);
      onCatalogUpdate();

      setName('');
      setUFactor('');
      setDescription('');
      setActiveCategory(formCategory);

      showToast('success', `Material "${newOption.name}" adicionado com sucesso!`);
    } catch (err) {
      showToast('error', 'Falha ao salvar o novo material.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMaterial = async (category: keyof MaterialCatalog, id: string, matName: string) => {
    if (!confirm(`Deseja realmente excluir o material "${matName}"?`)) return;

    try {
      const updatedCatalog = await defaultMaterialService.removeMaterial(category, id);
      setCatalog(updatedCatalog);
      onCatalogUpdate();
      showToast('success', `Material "${matName}" removido com sucesso.`);
    } catch (err) {
      showToast('error', 'Falha ao remover o material.');
    }
  };

  const handleExportJSON = () => {
    const jsonStr = defaultMaterialService.exportToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog_materiais_hvac_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Catálogo exportado em formato JSON com sucesso!');
  };

  const handleExportCSV = () => {
    const csvStr = defaultMaterialService.exportToCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog_materiais_hvac_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Catálogo exportado em formato CSV com sucesso!');
  };

  const categoryLabels = {
    paredes: 'Paredes & Alvenaria',
    telhados: 'Telhados & Coberturas',
    vidros: 'Vidros & Esquadrias'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.12)] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 tracking-tight">
                Gerenciador do Catálogo de Materiais Térmicos
              </h2>
              <p className="text-xs text-slate-400">
                Transmitância Térmica (Fator U em W/m²K) de acordo com a norma ABNT NBR 15220
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Exportar CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /> CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Exportar JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /> JSON
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-500/30'
                : 'bg-rose-950/90 text-rose-300 border-b border-rose-500/30'
            }`}
          >
            {notification.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            {notification.text}
          </div>
        )}

        {/* Body Content (Bento 2 Columns) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Form to Add New Material */}
          <div className="lg:col-span-5 bg-slate-950/70 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Cadastrar Novo Material
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">U-Factor W/m²K</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoria da Envoltória
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-medium"
                >
                  <option value="paredes">Paredes & Alvenaria</option>
                  <option value="telhados">Telhados & Coberturas</option>
                  <option value="vidros">Vidros & Esquadrias</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Material / Componente
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alvenaria Bloco Cerâmico 14cm + EPS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transmitância Térmica (Fator U em W/m²K)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 1.85"
                  value={uFactor}
                  onChange={(e) => setUFactor(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Especificação / Composição Física
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva a espessura, densidade, camadas de argamassa, lã de vidro, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Adicionar ao Catálogo
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Valores U menores representam melhor isolamento térmico da edificação.</span>
            </div>
          </div>

          {/* Right Column: Catalog Viewer */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* Category Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                {(['paredes', 'telhados', 'vidros'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      activeCategory === cat
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {categoryLabels[cat]} ({catalog ? catalog[cat].length : 0})
                  </button>
                ))}
              </div>

              {/* Real-time Search Filter Input */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar material ou U..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* List of Materials */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[440px] pr-1">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 gap-2 text-xs font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> Carregando catálogo...
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/80">
                  {searchQuery ? `Nenhum material encontrado para "${searchQuery}".` : 'Nenhum material cadastrado nesta categoria.'}
                </div>
              ) : (
                filteredMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-3.5 bg-slate-950/50 border border-slate-800 hover:border-cyan-500/40 rounded-xl flex items-start justify-between gap-4 transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-200">{mat.name}</h4>
                        <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700/60 text-[10px] font-mono font-bold rounded-md shadow-inner">
                          U = {mat.uFactor} W/m²K
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {mat.description}
                      </p>
                      <span className="text-[9px] font-mono text-slate-600 block">
                        ID: {mat.id}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveMaterial(activeCategory, mat.id, mat.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors border border-transparent hover:border-rose-900/50"
                      title="Excluir material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center text-xs text-slate-500">
          <span>Persistência local: <code className="text-cyan-400 font-mono">src/data/materials.json</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
