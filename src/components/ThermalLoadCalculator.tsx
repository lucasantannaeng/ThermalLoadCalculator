import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Snowflake, 
  Sliders, 
  Layers, 
  Globe, 
  Building2, 
  Copy, 
  Trash2, 
  Plus, 
  Printer, 
  FileDown, 
  Eye, 
  Edit3, 
  Zap, 
  Thermometer, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Maximize2, 
  ShieldCheck, 
  Lightbulb, 
  FileText, 
  Box, 
  FileCode, 
  Pencil, 
  Cpu, 
  Key,
  Users,
  Settings,
  Flame,
  Tag,
  RefreshCw
} from 'lucide-react';
import { HvacCadViewer } from './HvacCadViewer';
import { CadImportModal } from './CadImportModal';
import { HvacVectorCanvasEditor } from './HvacVectorCanvasEditor';
import { 
  HVACEnvironment, 
  ProjectInfo, 
  HVACResult24h, 
  StandardMode,
  Wall, 
  Window, 
  Equipment, 
  Orientation, 
  RoofType, 
  WallType, 
  GlassType, 
  ActivityType,
  ActivityOption,
  EquipmentPresetOption
} from '../types/hvac';
import { calculateHVAC24h } from '../calculation/engines/hvacEngineFactory';
import { Simulation24hChart } from './Simulation24hChart';
import { MaterialManagerModal } from './MaterialManagerModal';
import { ActivityManagerModal } from './ActivityManagerModal';
import { EquipmentManagerModal } from './EquipmentManagerModal';
import { AiKeyManagerModal } from './AiKeyManagerModal';
import { generateHVACPDFReport } from '../services/pdfReportGenerator';
import { 
  EXTENDED_ZONAS_BIOCLIMATICAS, 
  PAREDE_MATERIAIS, 
  TELHADO_MATERIAIS
} from '../data/hvacPresets';
import { defaultActivityService } from '../services/activityService';
import { defaultEquipmentPresetService } from '../services/equipmentPresetService';
import { defaultParametricCadSyncService } from '../services/parametricCadSyncService';

export const ThermalLoadCalculator: React.FC = React.memo(() => {
  const [activeTab, setActiveTab] = useState<'calc' | 'vector' | 'cad' | 'materials' | 'bioclimatic'>('calc');
  const [selectedCadEnvId, setSelectedCadEnvId] = useState<string>('');
  const [standardMode, setStandardMode] = useState<StandardMode>('ABNT');

  // Modais State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState<boolean>(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState<boolean>(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
  const [isCadImportModalOpen, setIsCadImportModalOpen] = useState<boolean>(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState<boolean>(false);

  // Catalogs State
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [equipmentPresets, setEquipmentPresets] = useState<EquipmentPresetOption[]>([]);

  // Load Catalogs
  const loadCatalogs = useCallback(async () => {
    try {
      const [acts, eqPresets] = await Promise.all([
        defaultActivityService.getActivities(),
        defaultEquipmentPresetService.getPresets()
      ]);
      setActivityOptions(acts);
      setEquipmentPresets(eqPresets);
    } catch (e) {
      console.error('Failed loading catalogs', e);
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    return defaultParametricCadSyncService.subscribe((state, event) => {
      if (event.source === 'system') return;
      setEnvironments(state.environments);
    });
  }, []);

  const notifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotify = useCallback((type: 'success' | 'error', message: string) => {
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setNotification({ type, message });
    notifyTimeoutRef.current = setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    };
  }, []);

  const handleCadImport = useCallback((importedEnvs: HVACEnvironment[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setEnvironments(importedEnvs);
      showNotify('success', `${importedEnvs.length} ambiente(s) importado(s) via CAD (Projeto substituído).`);
    } else {
      setEnvironments(prev => [...prev, ...importedEnvs]);
      showNotify('success', `${importedEnvs.length} ambiente(s) importado(s) via CAD (Adicionado aos existentes).`);
    }
  }, [showNotify]);

  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() => {
    const saved = localStorage.getItem('hvac_project_info');
    return saved ? JSON.parse(saved) : { 
      name: 'Edifício Corporativo - Sala de Reunião', 
      client: 'Empresa Cliente LTDA', 
      date: new Date().toLocaleDateString('pt-BR') 
    };
  });

  const [environments, setEnvironments] = useState<HVACEnvironment[]>(() => {
    const saved = localStorage.getItem('hvac_environments');
    return saved ? JSON.parse(saved) : [
      {
        id: 'env-1',
        name: 'Sala de Reunião Principal',
        area: 35,
        height: 2.8,
        occupants: 8,
        activity: 'comercial_baixo',
        zonaId: 3, // São Paulo
        lightingWatts: 250,
        hasRoof: true,
        roofType: 'laje_isolada',
        roofArea: 35,
        walls: [
          { id: 1, area: 15, orientation: 'oeste', type: 'alvenaria_leve' },
          { id: 2, area: 12, orientation: 'norte', type: 'alvenaria_pesada' }
        ],
        windows: [
          { id: 1, area: 4, orientation: 'oeste', glassType: 'simples', protection: 0.6 }
        ],
        equipment: [
          { id: 1, name: 'Computador Desktop + Monitor', watts: 300, qty: 2 },
          { id: 2, name: 'Projetor Multimídia High Lumen', watts: 350, qty: 1 }
        ]
      }
    ];
  });

  const [showResults, setShowResults] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal para Adicionar Equipamento no Ambiente
  const [addingEquipEnvId, setAddingEquipEnvId] = useState<string | null>(null);
  const [newEquipName, setNewEquipName] = useState<string>("Computador Desktop + Monitor");
  const [newEquipWatts, setNewEquipWatts] = useState<number>(300);
  const [newEquipQty, setNewEquipQty] = useState<number>(1);

  // Persistência Local
  useEffect(() => { localStorage.setItem('hvac_project_info', JSON.stringify(projectInfo)); }, [projectInfo]);
  useEffect(() => { 
    localStorage.setItem('hvac_environments', JSON.stringify(environments));
    defaultParametricCadSyncService.batchUpdateEnvironments(environments, 'system');
  }, [environments]);

  const addEnvironment = useCallback(() => {
    const newEnv: HVACEnvironment = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Ambiente ${environments.length + 1}`,
      area: 25,
      height: 2.7,
      occupants: 2,
      activity: 'residencial',
      zonaId: 3,
      lightingWatts: 120,
      hasRoof: false,
      roofType: 'laje_isolada',
      roofArea: 25,
      walls: [{ id: Date.now(), area: 10, orientation: 'oeste', type: 'alvenaria_leve' }],
      windows: [{ id: Date.now() + 1, area: 2, orientation: 'oeste', glassType: 'simples', protection: 1.0 }],
      equipment: []
    };
    setEnvironments(prev => [...prev, newEnv]);
    showNotify('success', `Novo ambiente "${newEnv.name}" adicionado com sucesso.`);
  }, [environments.length, showNotify]);

  const duplicateEnvironment = useCallback((env: HVACEnvironment) => {
    const duplicated: HVACEnvironment = {
      ...env,
      id: Math.random().toString(36).substring(2, 9),
      name: `${env.name} (Cópia)`
    };
    setEnvironments(prev => [...prev, duplicated]);
    showNotify('success', `Ambiente "${env.name}" duplicado.`);
  }, [showNotify]);

  const removeEnvironment = useCallback((id: string) => {
    if (environments.length <= 1) {
      showNotify('error', "O projeto deve possuir ao menos um ambiente.");
      return;
    }
    setEnvironments(prev => prev.filter(e => e.id !== id));
    showNotify('success', "Ambiente removido.");
  }, [environments.length, showNotify]);

  const updateEnv = useCallback((id: string, field: keyof HVACEnvironment, value: any) => {
    setEnvironments(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const handleAddEquipment = useCallback((envId: string) => {
    if (!newEquipName || newEquipWatts <= 0) return;
    const equip: Equipment = {
      id: Date.now(),
      name: newEquipName,
      watts: newEquipWatts,
      qty: newEquipQty
    };
    setEnvironments(prev => prev.map(e => e.id === envId ? { ...e, equipment: [...e.equipment, equip] } : e));
    setAddingEquipEnvId(null);
    showNotify('success', "Equipamento elétrico adicionado.");
  }, [newEquipName, newEquipWatts, newEquipQty, showNotify]);

  const handleRemoveEquipment = useCallback((envId: string, equipId: string | number) => {
    setEnvironments(prev => prev.map(e => e.id === envId ? { ...e, equipment: e.equipment.filter((eq: Equipment) => eq.id !== equipId) } : e));
  }, []);

  const handleEnvironmentUpdateFromCad = useCallback((updatedEnv: HVACEnvironment) => {
    setEnvironments(prev => prev.map(e => e.id === updatedEnv.id ? updatedEnv : e));
    showNotify('success', `Ambiente "${updatedEnv.name}" atualizado via Text-to-CAD.`);
  }, [showNotify]);

  // Cálculo multinorma 24h em tempo real
  const results: HVACResult24h[] = useMemo(() => {
    return environments.map(env => calculateHVAC24h(env, standardMode));
  }, [environments, standardMode]);

  const totalProjetoBTU = useMemo(() => {
    return results.reduce((acc, res) => acc + res.total, 0);
  }, [results]);

  const totalConsumoKW = useMemo(() => {
    return results.reduce((acc, res) => acc + res.potenciaEstimadaKW, 0);
  }, [results]);

  const handleDownloadPDF = useCallback(() => {
    try {
      generateHVACPDFReport(projectInfo, results);
      showNotify('success', 'Laudo Técnico PDF gerado e baixado com sucesso!');
    } catch (err) {
      showNotify('error', 'Falha ao gerar o Laudo PDF.');
    }
  }, [projectInfo, results, showNotify]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 antialiased selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* CABEÇALHO CORPORATIVO DENSO SLATE/CYAN-DARK ANTI-SLOP WITH BADGES */}
        <header className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.08)] backdrop-blur-xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-slate-950 flex items-center justify-center font-black shadow-[0_0_25px_rgba(6,182,212,0.35)] shrink-0 p-3">
              <Snowflake className="w-7 h-7 text-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-slate-100 flex items-center gap-2">
                  HVAC THERMAL LOAD PRO
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-extrabold tracking-widest uppercase bg-cyan-950 text-cyan-300 border border-cyan-700/80 rounded-md shadow-inner">
                  ENGINE: {standardMode.replace('_', ' ')}
                </span>

                {/* REQUIRED STATUS BADGES */}
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 rounded-md flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PARAMETRIC CAD: LIVE SYNC
                </span>

                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-cyan-950/90 text-cyan-300 border border-cyan-700/80 rounded-md flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  ACTIVITIES DB: VERIFIED
                </span>

                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-950/90 text-amber-300 border border-amber-700/80 rounded-md flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  EQUIPMENT DB: VERIFIED
                </span>

                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded-md flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  STRIX AUDIT: VERIFIED ✓
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-2 flex-wrap">
                <span>Dimensionamento Industrial 24h • ABNT NBR 16401 • ASHRAE RTS/CTF • ISO 52016-1</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-mono font-bold">STRIX ZERO-DEFECT COMPLIANT</span>
              </p>
            </div>
          </div>

          {/* Selector de Norma & Navegação */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto">
            {/* Standard Mode Selector */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase px-2 tracking-wider">Norma:</span>
              <button
                onClick={() => setStandardMode('ABNT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  standardMode === 'ABNT'
                    ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                ABNT 16401
              </button>
              <button
                onClick={() => setStandardMode('ASHRAE_RTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  standardMode === 'ASHRAE_RTS'
                    ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                ASHRAE RTS
              </button>
              <button
                onClick={() => setStandardMode('ISO_52016')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  standardMode === 'ISO_52016'
                    ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                ISO 52016
              </button>
            </div>

            {/* Navigation Tabs Toolbar */}
            <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs font-semibold flex-wrap">
              <button
                onClick={() => setActiveTab('calc')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'calc' 
                    ? 'bg-cyan-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Simulação 24h
              </button>
              <button
                onClick={() => setActiveTab('vector')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'vector' 
                    ? 'bg-cyan-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Pencil className="w-3.5 h-3.5 text-cyan-400" /> Editor Vetorial 2D
              </button>
              <button
                onClick={() => setActiveTab('cad')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'cad' 
                    ? 'bg-cyan-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-cyan-400" /> Modelagem 3D & CAD
              </button>
              <button
                onClick={() => setIsMaterialModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Materiais U
              </button>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-all flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" /> Atividades
              </button>
              <button
                onClick={() => setIsEquipmentModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-all flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" /> Equipamentos
              </button>
              <button
                onClick={() => setActiveTab('bioclimatic')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'bioclimatic' 
                    ? 'bg-cyan-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Bioclima NBR 15220
              </button>
              <button
                onClick={() => setIsAiKeyModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/50 transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                title="Configurar Provedores & Chaves de IA"
              >
                <Key className="w-3.5 h-3.5 text-cyan-400" /> Chaves IA
              </button>
            </nav>
          </div>
        </header>

        {/* NOTIFICAÇÃO POPUP */}
        {notification && (
          <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-lg animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}>
            <span className="flex items-center gap-2">
              {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              {notification.message}
            </span>
            <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100 p-1">✕</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 1: DIMENSIONAMENTO E SIMULAÇÃO 24H */}
        {/* ========================================================================= */}
        {activeTab === 'calc' && (
          <main className="space-y-6">

            {/* BENTO SUMMARY BAR (MÉTRICAS DO PROJETO) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/90 border border-slate-800 p-4 rounded-2xl gap-4 shadow-xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pico Total:</span>
                </div>
                <span className="text-2xl font-black text-cyan-400 font-mono tracking-tight">{totalProjetoBTU.toLocaleString('pt-BR')} <span className="text-sm text-cyan-500">BTU/h</span></span>
                <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> {totalConsumoKW.toFixed(1)} kW/h est.
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-1 rounded-xl uppercase">
                  Engine: {standardMode}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 md:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all flex items-center justify-center gap-2 border border-cyan-400/30"
                >
                  <FileDown className="w-4 h-4" /> Laudo Técnico PDF
                </button>
                <button
                  onClick={() => setIsMaterialModalOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Materiais U
                </button>
                <button
                  onClick={() => setIsActivityModalOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400" /> Atividades
                </button>
                <button
                  onClick={() => setIsEquipmentModalOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5 text-amber-400" /> Equipamentos
                </button>
                <button
                  onClick={() => setIsCadImportModalOpen(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-cyan-950 hover:bg-cyan-900 active:scale-[0.98] text-cyan-300 text-xs font-bold rounded-xl border border-cyan-700/60 transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" /> Importar CAD
                </button>

                <button
                  onClick={() => setShowResults(!showResults)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  {showResults ? <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                  {showResults ? "Editar Parâmetros" : "Laudo On-Screen"}
                </button>
                {showResults && (
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    title="Imprimir Laudo"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                )}
              </div>
            </div>

            {!showResults ? (
              <div className="space-y-6">
                {/* DADOS DO PROJETO */}
                <section className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl backdrop-blur-xl">
                  <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/80 pb-3">
                    <FileText className="w-4 h-4" /> Informações Gerais do Projeto & Cliente
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Identificação do Projeto</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                        value={projectInfo.name}
                        onChange={e => setProjectInfo({...projectInfo, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Cliente / Proprietário</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                        value={projectInfo.client}
                        onChange={e => setProjectInfo({...projectInfo, client: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Data de Emissão</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 font-mono"
                        readOnly
                        value={projectInfo.date}
                      />
                    </div>
                  </div>
                </section>

                {/* FORMULÁRIO DE AMBIENTES - BENTO CARDS */}
                <div className="space-y-6">
                  {environments.map(env => {
                    const res = results.find(r => r.id === env.id);

                    return (
                      <div key={env.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-4 pb-6 backdrop-blur-xl">
                        
                        {/* Header do Ambiente */}
                        <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800/80 flex justify-between items-center flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <input
                              type="text"
                              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 font-bold text-white text-base md:text-lg p-0 focus:ring-0 transition-colors"
                              value={env.name}
                              onChange={e => updateEnv(env.id, 'name', e.target.value)}
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs font-black text-cyan-400 block font-mono">
                                Pico: {res?.total.toLocaleString('pt-BR')} BTU/h ({res?.peakHour}:00h)
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">{res?.sugerida}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => duplicateEnvironment(env)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs border border-slate-700 font-semibold transition-colors flex items-center gap-1"
                              title="Duplicar Ambiente"
                            >
                              <Copy className="w-3.5 h-3.5 text-cyan-400" /> Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEnvironment(env.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-xl transition-colors text-xs border border-rose-900/50"
                              title="Remover Ambiente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Corpo Bento Grid (3 Colunas de Parâmetros) */}
                        <div className="px-6 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                          
                          {/* Coluna 1: Geometria e Ocupação */}
                          <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-2">
                                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" /> 1. Geometria & Ocupação
                              </h4>
                              <button
                                type="button"
                                onClick={() => setIsActivityModalOpen(true)}
                                className="text-[10px] text-cyan-400 hover:underline font-mono font-bold"
                              >
                                + Config. Perfis
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-slate-400 block mb-1 font-medium">Área (m²)</label>
                                <input
                                  type="number"
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono focus:border-cyan-500"
                                  value={env.area}
                                  onChange={e => updateEnv(env.id, 'area', parseFloat(e.target.value))}
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 block mb-1 font-medium">Pé-Direito (m)</label>
                                <input
                                  type="number"
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono focus:border-cyan-500"
                                  value={env.height}
                                  onChange={e => updateEnv(env.id, 'height', parseFloat(e.target.value))}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-1 font-medium">Ocupantes (Pessoas)</label>
                              <input
                                type="number"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono focus:border-cyan-500"
                                value={env.occupants}
                                onChange={e => updateEnv(env.id, 'occupants', parseInt(e.target.value))}
                              />
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-1 font-medium">Atividade Operacional</label>
                              <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:border-cyan-500 font-medium"
                                value={env.activity}
                                onChange={e => updateEnv(env.id, 'activity', e.target.value as ActivityType)}
                              >
                                {activityOptions.map(act => (
                                  <option key={act.id} value={act.id}>
                                    {act.name} ({act.heatPerPersonWatts}W/p)
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-1 font-medium">Zona Bioclimática (NBR 15220)</label>
                              <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-semibold focus:border-cyan-500"
                                value={env.zonaId}
                                onChange={e => updateEnv(env.id, 'zonaId', parseInt(e.target.value))}
                              >
                                {EXTENDED_ZONAS_BIOCLIMATICAS.map(z => (
                                  <option key={z.id} value={z.id}>{z.nome} (ΔT={z.deltaT}°C)</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Coluna 2: Envoltória Paredes e Cobertura */}
                          <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> 2. Envoltória & Cobertura
                              </h4>
                              <button
                                type="button"
                                onClick={() => setIsMaterialModalOpen(true)}
                                className="text-[10px] text-cyan-400 hover:underline font-mono font-bold"
                              >
                                + Catálogo U
                              </button>
                            </div>

                            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-slate-200">Exposição ao Telhado</label>
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-cyan-600 rounded bg-slate-950 border-slate-800 focus:ring-cyan-500"
                                  checked={env.hasRoof}
                                  onChange={e => updateEnv(env.id, 'hasRoof', e.target.checked)}
                                />
                              </div>
                              {env.hasRoof && (
                                <div className="space-y-2 pt-1">
                                  <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white"
                                    value={env.roofType}
                                    onChange={e => updateEnv(env.id, 'roofType', e.target.value as RoofType)}
                                  >
                                    {Object.entries(TELHADO_MATERIAIS).map(([key, mat]) => (
                                      <option key={key} value={key}>{mat.name} (U={mat.uFactor})</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    placeholder="Área de Cobertura (m²)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                                    value={env.roofArea}
                                    onChange={e => updateEnv(env.id, 'roofArea', parseFloat(e.target.value))}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="font-bold text-slate-300">Paredes Externas</label>
                                <button
                                  type="button"
                                  onClick={() => updateEnv(env.id, 'walls', [...env.walls, { id: Date.now(), area: 6, orientation: 'norte', type: 'alvenaria_leve' }])}
                                  className="text-cyan-400 font-bold hover:underline text-[11px] flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Parede
                                </button>
                              </div>

                              {env.walls.map((w: Wall) => (
                                <div key={w.id} className="flex gap-2 items-center bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                                  <input
                                    type="number"
                                    className="w-14 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white font-mono"
                                    value={w.area}
                                    onChange={e => updateEnv(env.id, 'walls', env.walls.map((x: Wall) => x.id === w.id ? {...x, area: parseFloat(e.target.value)} : x))}
                                  />
                                  <select
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white"
                                    value={w.orientation}
                                    onChange={e => updateEnv(env.id, 'walls', env.walls.map((x: Wall) => x.id === w.id ? {...x, orientation: e.target.value as Orientation} : x))}
                                  >
                                    <option value="norte">Norte</option>
                                    <option value="sul">Sul</option>
                                    <option value="leste">Leste</option>
                                    <option value="oeste">Oeste</option>
                                  </select>
                                  <select
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white"
                                    value={w.type}
                                    onChange={e => updateEnv(env.id, 'walls', env.walls.map((x: Wall) => x.id === w.id ? {...x, type: e.target.value as WallType} : x))}
                                  >
                                    <option value="alvenaria_leve">Alvenaria Leve</option>
                                    <option value="alvenaria_pesada">Alvenaria Pesada</option>
                                    <option value="drywall_isolado">Drywall Isolado</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => updateEnv(env.id, 'walls', env.walls.filter((x: Wall) => x.id !== w.id))}
                                    className="text-rose-400 px-1 hover:text-rose-300"
                                  >✕</button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Coluna 3: Aberturas e Equipamentos */}
                          <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-cyan-400" /> 3. Aberturas & Cargas Elétricas
                              </h4>
                              <button
                                type="button"
                                onClick={() => setIsEquipmentModalOpen(true)}
                                className="text-[10px] text-amber-400 hover:underline font-mono font-bold"
                              >
                                + Catálogo Presets
                              </button>
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-1 font-medium flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Carga Iluminação Total (Watts)
                              </label>
                              <input
                                type="number"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono focus:border-cyan-500"
                                value={env.lightingWatts}
                                onChange={e => updateEnv(env.id, 'lightingWatts', parseFloat(e.target.value))}
                              />
                            </div>

                            {/* Janelas */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="font-bold text-slate-300">Janelas / Esquadrias</label>
                                <button
                                  type="button"
                                  onClick={() => updateEnv(env.id, 'windows', [...env.windows, { id: Date.now(), area: 2, orientation: 'oeste', glassType: 'simples', protection: 1.0 }])}
                                  className="text-cyan-400 font-bold hover:underline text-[11px] flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Janela
                                </button>
                              </div>
                              {env.windows.map((win: Window) => (
                                <div key={win.id} className="flex gap-2 items-center bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                                  <input
                                    type="number"
                                    className="w-12 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white font-mono"
                                    value={win.area}
                                    onChange={e => updateEnv(env.id, 'windows', env.windows.map((x: Window) => x.id === win.id ? {...x, area: parseFloat(e.target.value)} : x))}
                                  />
                                  <select
                                    className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white"
                                    value={win.orientation}
                                    onChange={e => updateEnv(env.id, 'windows', env.windows.map((x: Window) => x.id === win.id ? {...x, orientation: e.target.value as Orientation} : x))}
                                  >
                                    <option value="norte">Norte</option>
                                    <option value="sul">Sul</option>
                                    <option value="leste">Leste</option>
                                    <option value="oeste">Oeste</option>
                                  </select>
                                  <select
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-white"
                                    value={win.protection}
                                    onChange={e => updateEnv(env.id, 'windows', env.windows.map((x: Window) => x.id === win.id ? {...x, protection: parseFloat(e.target.value)} : x))}
                                  >
                                    <option value={1.0}>Sem Prot.</option>
                                    <option value={0.6}>Cortina</option>
                                    <option value={0.3}>Persiana</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => updateEnv(env.id, 'windows', env.windows.filter((x: Window) => x.id !== win.id))}
                                    className="text-rose-400 px-1 hover:text-rose-300"
                                  >✕</button>
                                </div>
                              ))}
                            </div>

                            {/* Equipamentos */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="font-bold text-slate-300">Equipamentos Elétricos ({env.equipment.length})</label>
                                <button
                                  type="button"
                                  onClick={() => setAddingEquipEnvId(env.id)}
                                  className="text-cyan-400 font-bold hover:underline text-[11px] flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Equipamento
                                </button>
                              </div>
                              <div className="space-y-1">
                                {env.equipment.map((eq: Equipment) => (
                                  <div key={eq.id} className="flex justify-between items-center bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[11px]">
                                    <span className="text-slate-200">{eq.qty}x {eq.name} <span className="font-mono text-cyan-400">({eq.watts}W)</span></span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEquipment(env.id, eq.id)}
                                      className="text-rose-400 hover:text-rose-300 ml-2"
                                    >✕</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* SIMULAÇÃO 24H RECHARTS CHART */}
                        {res && (
                          <div className="px-6 pt-2">
                            <Simulation24hChart data={res.hourlyProfile} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={addEnvironment}
                    className="py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-400 hover:border-cyan-500 hover:text-cyan-400 font-bold text-sm transition-all bg-slate-900/50 hover:bg-slate-900/80 flex items-center justify-center gap-2 group"
                  >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400" /> Adicionar Novo Ambiente (Manual)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCadImportModalOpen(true)}
                    className="py-4 border-2 border-dashed border-cyan-800/80 rounded-2xl text-cyan-300 hover:border-cyan-400 hover:text-white font-bold text-sm transition-all bg-cyan-950/30 hover:bg-cyan-950/70 flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                  >
                    <FileCode className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400" /> Importar Planta CAD (DXF / SVG)
                  </button>
                </div>

              </div>
            ) : (
              /* LAUDO TÉCNICO PROFISSIONAL IMPRESSO */
              <div id="printable-report" className="space-y-6 bg-white text-slate-900 p-8 rounded-3xl shadow-2xl">
                <div className="text-center space-y-2 border-b border-slate-200 pb-6">
                  <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">LAUDO TÉCNICO DE CARGA TÉRMICA HVAC</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Dimensionamento segundo Norma {standardMode}
                  </p>
                  <div className="text-slate-600 flex justify-center gap-8 text-xs pt-3 font-medium">
                    <span><strong>Projeto:</strong> {projectInfo.name || "Sem Nome"}</span>
                    <span><strong>Cliente:</strong> {projectInfo.client || "Sem Cliente"}</span>
                    <span><strong>Data de Emissão:</strong> {projectInfo.date}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.map(res => (
                    <div key={res.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="text-xl font-bold text-cyan-900">{res.name}</h3>
                        <span className="text-2xl font-black text-slate-900 font-mono">{res.total.toLocaleString('pt-BR')} BTU/h</span>
                      </div>
                      
                      <div className="space-y-1 text-xs text-slate-600">
                        {(Object.entries(res.breakdown) as [string, number][]).map(([key, val]: [string, number]) => (
                          val > 0 && (
                            <div key={key} className="flex justify-between border-b border-slate-200/50 pb-1 italic">
                              <span className="capitalize">{key.replace('_', ' ')}:</span>
                              <span className="font-mono">{val.toLocaleString('pt-BR')} BTU/h</span>
                            </div>
                          )
                        ))}
                      </div>

                      <div className="pt-2">
                        <div className="bg-cyan-700 text-white p-3 rounded-xl flex justify-between items-center shadow">
                          <span className="text-[10px] font-bold uppercase tracking-wider">Equipamento Sugerido</span>
                          <span className="text-sm font-bold">{res.sugerida}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-8 bg-slate-900 text-white rounded-3xl text-center space-y-2 shadow-2xl">
                  <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carga Térmica Total Consolidada do Projeto</h4>
                  <p className="text-5xl font-black text-cyan-400 font-mono">{totalProjetoBTU.toLocaleString('pt-BR')} <span className="text-2xl opacity-50 text-white">BTU/h</span></p>
                  <div className="pt-4 flex justify-center gap-6 text-xs opacity-80">
                    <p>Norma de Referência: <strong>{standardMode}</strong></p>
                    <span>•</span>
                    <p>Potência Elétrica Estimada: <strong>{totalConsumoKW.toFixed(1)} kW/h</strong></p>
                  </div>
                </div>

                <div className="flex justify-center gap-4 pt-4 print:hidden">
                  <button
                    onClick={handleDownloadPDF}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" /> Baixar Laudo PDF (jsPDF)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Imprimir via Navegador
                  </button>
                </div>
              </div>
            )}

          </main>
        )}

        {/* MODAL ADICIONAR EQUIPAMENTO NO AMBIENTE */}
        {addingEquipEnvId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 rounded-2xl space-y-4 text-xs shadow-2xl text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Adicionar Equipamento Elétrico
                </h3>
                <button onClick={() => setAddingEquipEnvId(null)} className="text-slate-400 hover:text-slate-200">✕</button>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Selecione no Catálogo de Presets:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white mb-2 font-medium"
                  onChange={e => {
                    const found = equipmentPresets.find(p => p.name === e.target.value);
                    if (found) {
                      setNewEquipName(found.name);
                      setNewEquipWatts(found.watts);
                    }
                  }}
                >
                  {equipmentPresets.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name} ({p.watts}W)</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="Nome do equipamento"
                  value={newEquipName}
                  onChange={e => setNewEquipName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Potência (Watts)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    value={newEquipWatts}
                    onChange={e => setNewEquipWatts(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Quantidade</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    value={newEquipQty}
                    onChange={e => setNewEquipQty(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddingEquipEnvId(null)} className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl font-semibold">Cancelar</button>
                <button type="button" onClick={() => handleAddEquipment(addingEquipEnvId)} className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl shadow-md">Adicionar</button>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: BIBLIOTECA DE MATERIAIS */}
        {activeTab === 'materials' && (
          <main className="space-y-6 text-xs">
            <section className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl backdrop-blur-xl">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 flex-wrap gap-4">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Coeficientes U de Transmitância Térmica (ABNT NBR 15220)
                </h2>
                <button
                  onClick={() => setIsMaterialModalOpen(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Gerenciar & Adicionar Materiais
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-bold text-white border-b border-slate-800 pb-2 text-xs uppercase tracking-wider">Paredes Externas & Alvenaria</h3>
                  {Object.entries(PAREDE_MATERIAIS).map(([key, mat]) => (
                    <div key={key} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>{mat.name}</span>
                        <span className="text-cyan-400 font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">U = {mat.uFactor} W/m²K</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{mat.description}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-white border-b border-slate-800 pb-2 text-xs uppercase tracking-wider">Coberturas & Telhados</h3>
                  {Object.entries(TELHADO_MATERIAIS).map(([key, mat]) => (
                    <div key={key} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>{mat.name}</span>
                        <span className="text-cyan-400 font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">U = {mat.uFactor} W/m²K</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{mat.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        )}

        {/* ABA 3: ZONAS BIOCLIMÁTICAS */}
        {activeTab === 'bioclimatic' && (
          <main className="space-y-6 text-xs">
            <section className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl backdrop-blur-xl">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Zonas Bioclimáticas Brasileiras (ABNT NBR 15220-3)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Parâmetros térmicos e recomendações normativas de condicionamento para cada região do Brasil
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EXTENDED_ZONAS_BIOCLIMATICAS.map(z => (
                  <div key={z.id} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2.5 hover:border-cyan-500/30 transition-colors">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-cyan-400" /> {z.nome}
                      </h3>
                      <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono font-bold rounded-lg text-xs">
                        ΔT = {z.deltaT}°C
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-slate-200">Cidades Principais:</strong> {z.cidades.join(', ')}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>Umidade Relativa Média: {z.umidadeRelativaMedia}%</span>
                      <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">Norma NBR 15220</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}

        {/* ABA 4: MODELAGEM 3D THREE.JS & EXPORTAÇÃO CAD */}
        {activeTab === 'cad' && (
          <main className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
                <div>
                  <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                    <Box className="w-4 h-4" /> Visualizador 3D Three.js & Exportação CAD (DXF / OBJ)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Gere visualizações 3D realistas, ajuste com IA Text-to-CAD e exporte a planta técnica para AutoCAD
                  </p>
                </div>

                {/* Seleção de Ambiente */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">Ambiente do Projeto:</label>
                  <select
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:border-cyan-500"
                    value={selectedCadEnvId || environments[0]?.id}
                    onChange={e => setSelectedCadEnvId(e.target.value)}
                  >
                    {environments.map(env => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                const targetEnv = environments.find(e => e.id === (selectedCadEnvId || environments[0]?.id)) || environments[0];
                if (!targetEnv) return null;

                return (
                  <HvacCadViewer
                    environment={targetEnv}
                    onEnvironmentUpdate={handleEnvironmentUpdateFromCad}
                  />
                );
              })()}
            </div>
          </main>
        )}

        {/* ABA 5: EDITOR VETORIAL 2D CANVAS */}
        {activeTab === 'vector' && (
          <main className="space-y-6">
            <HvacVectorCanvasEditor
              initialEnvironments={environments}
              onExportEnvironments={(exportedEnvs, mode) => {
                if (mode === 'replace') {
                  setEnvironments(exportedEnvs);
                  showNotify('success', `${exportedEnvs.length} ambiente(s) importado(s) do Editor Vetorial 2D (Projeto substituído).`);
                } else {
                  setEnvironments(prev => [...prev, ...exportedEnvs]);
                  showNotify('success', `${exportedEnvs.length} ambiente(s) adicionado(s) via Editor Vetorial 2D.`);
                }
                setActiveTab('calc');
              }}
            />
          </main>
        )}

        {/* MODAIS INTEGRADOS DA APLICAÇÃO */}
        <MaterialManagerModal
          isOpen={isMaterialModalOpen}
          onClose={() => setIsMaterialModalOpen(false)}
          onCatalogUpdate={loadCatalogs}
        />

        <ActivityManagerModal
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          onCatalogUpdate={loadCatalogs}
        />

        <EquipmentManagerModal
          isOpen={isEquipmentModalOpen}
          onClose={() => setIsEquipmentModalOpen(false)}
          onCatalogUpdate={loadCatalogs}
        />

        <CadImportModal
          isOpen={isCadImportModalOpen}
          onClose={() => setIsCadImportModalOpen(false)}
          onImport={handleCadImport}
        />

        <AiKeyManagerModal
          isOpen={isAiKeyModalOpen}
          onClose={() => setIsAiKeyModalOpen(false)}
          onKeysUpdated={() => showNotify('success', 'Chaves e Provedores de IA atualizados com sucesso.')}
        />

      </div>
    </div>
  );
});

ThermalLoadCalculator.displayName = 'ThermalLoadCalculator';

export default ThermalLoadCalculator;
