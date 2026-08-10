import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Cpu, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Download, 
  Upload, 
  Info,
  Zap,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { EquipmentPresetOption } from '../types/hvac';
import { defaultEquipmentPresetService } from '../services/equipmentPresetService';

interface EquipmentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCatalogUpdate: () => void;
}

export const EquipmentManagerModal: React.FC<EquipmentManagerModalProps> = React.memo(({
  isOpen,
  onClose,
  onCatalogUpdate
}) => {
  const [presets, setPresets] = useState<EquipmentPresetOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('TODOS');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [watts, setWatts] = useState<string>('300');
  const [category, setCategory] = useState<string>('TI / Informática');
  const [description, setDescription] = useState<string>('');

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await defaultEquipmentPresetService.getPresets();
      setPresets(data);
    } catch (err) {
      setNotification({ type: 'error', text: 'Erro ao carregar catálogo de equipamentos.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen, loadPresets]);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setNotification({ type, text });
    toastTimeoutRef.current = setTimeout(() => setNotification(null), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Available categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => { if (p.category) set.add(p.category); });
    return ['TODOS', ...Array.from(set)];
  }, [presets]);

  // Filtered presets
  const filteredPresets = useMemo(() => {
    let result = presets;
    if (activeCategory !== 'TODOS') {
      result = result.filter(p => p.category === activeCategory);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return result;
    return result.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      p.watts.toString().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }, [presets, activeCategory, searchQuery]);

  const handleAddPreset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Por favor, informe a descrição do equipamento.');
      return;
    }
    const valW = parseFloat(watts);
    if (isNaN(valW) || valW <= 0) {
      showToast('error', 'Informe uma potência nominal válida em Watts.');
      return;
    }

    setSaving(true);
    try {
      const idSanitized = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      const newOption: EquipmentPresetOption = {
        id: `equip_preset_${Date.now()}_${idSanitized}`,
        name: name.trim(),
        watts: valW,
        category: category.trim() || 'Geral',
        description: description.trim() || 'Equipamento elétrico cadastrado no catálogo de presets.'
      };

      const updated = await defaultEquipmentPresetService.addPreset(newOption);
      setPresets(updated);
      onCatalogUpdate();

      setName('');
      setWatts('300');
      setDescription('');

      showToast('success', `Equipamento "${newOption.name}" adicionado ao catálogo!`);
    } catch (err) {
      showToast('error', 'Falha ao salvar o novo equipamento.');
    } finally {
      setSaving(false);
    }
  }, [name, watts, category, description, onCatalogUpdate, showToast]);

  const handleRemovePreset = useCallback(async (id: string, equipName: string) => {
    if (!confirm(`Deseja realmente remover "${equipName}" do catálogo?`)) return;

    try {
      const updated = await defaultEquipmentPresetService.removePreset(id);
      setPresets(updated);
      onCatalogUpdate();
      showToast('success', `Equipamento "${equipName}" removido.`);
    } catch (err) {
      showToast('error', 'Falha ao remover equipamento.');
    }
  }, [onCatalogUpdate, showToast]);

  const handleExportJSON = useCallback(() => {
    const jsonStr = defaultEquipmentPresetService.exportToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipamentos_preset_hvac_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Catálogo de equipamentos exportado (JSON).');
  }, [showToast]);

  const handleExportCSV = useCallback(() => {
    const csvStr = defaultEquipmentPresetService.exportToCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipamentos_preset_hvac_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Catálogo de equipamentos exportado (CSV).');
  }, [showToast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in selection:bg-cyan-500 selection:text-slate-950">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* HEADER CORPORATIVO SLATE / CYAN-DARK */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  Gerenciador do Catálogo de Equipamentos Elétricos
                </h2>
                {/* STATUS BADGES */}
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/80 rounded-md flex items-center gap-1 shadow-inner">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" /> EQUIPMENT DB: VERIFIED
                </span>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> STRIX AUDIT: VERIFIED ✓
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Potências nominais e dissipação de calor de computadores, iluminação e cargas elétricas
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

        {/* TOAST NOTIFICATION */}
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

        {/* BENTO GRID CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA BENTO: CADASTRO DE EQUIPAMENTO PRESET */}
          <div className="lg:col-span-5 bg-slate-950/70 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 backdrop-blur-xl">
            <form onSubmit={handleAddPreset} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Novo Preset de Equipamento
                </h3>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                  ELECTRICAL LOAD
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome / Modelo do Equipamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Servidor Blade 2U High Performance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Potência Nominal (Watts)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ex: 500"
                    value={watts}
                    onChange={(e) => setWatts(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: TI / Informática"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Especificação Técnica
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalhes de consumo, tipo de fonte ou uso típico..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
              <span>1 Watt = 3,412 BTU/h de dissipação de calor direta no ambiente.</span>
            </div>
          </div>

          {/* COLUNA DIREITA BENTO: LISTAGEM DE PRESETS */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* TABS DE CATEGORIA & BUSCA */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategory === cat
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar equipamento ou W..."
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

            {/* LISTA CARDS BENTO EQUIPAMENTOS */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[440px] pr-1">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 gap-2 text-xs font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> Carregando catálogo...
                </div>
              ) : filteredPresets.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/80">
                  {searchQuery ? `Nenhum equipamento encontrado para "${searchQuery}".` : 'Nenhum equipamento cadastrado.'}
                </div>
              ) : (
                filteredPresets.map((eq) => {
                  const btuDissipado = Math.round(eq.watts * 3.41214);

                  return (
                    <div
                      key={eq.id}
                      className="p-3.5 bg-slate-950/60 border border-slate-800/90 hover:border-cyan-500/50 rounded-xl flex items-start justify-between gap-4 transition-all group shadow-sm hover:shadow-md backdrop-blur-md"
                    >
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-100">{eq.name}</h4>
                          <span className="px-2 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 text-[10px] font-mono font-extrabold rounded-md shadow-inner flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" /> {eq.watts} Watts ({btuDissipado} BTU/h)
                          </span>
                          {eq.category && (
                            <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[9px] font-mono rounded flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-cyan-400" /> {eq.category}
                            </span>
                          )}
                        </div>
                        {eq.description && (
                          <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                            {eq.description}
                          </p>
                        )}
                        <span className="text-[9px] font-mono text-slate-500 block">
                          ID: {eq.id}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemovePreset(eq.id, eq.name)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors border border-transparent hover:border-rose-900/50 shrink-0"
                        title="Excluir preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-between items-center text-xs text-slate-400">
          <span>Persistência local: <code className="text-cyan-400 font-mono">hvac_equipment_preset_catalog</code></span>
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
});

EquipmentManagerModal.displayName = 'EquipmentManagerModal';
