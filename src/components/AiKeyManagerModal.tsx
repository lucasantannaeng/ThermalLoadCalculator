import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Zap,
  Globe,
  Sliders,
  Check,
  Sparkles,
  Server,
  ShieldCheck
} from 'lucide-react';
import {
  AiProvider,
  AiProviderConfig,
  PROVIDER_DISPLAY_NAMES,
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_BASE_URLS,
  getProviderConfigs,
  saveProviderConfig,
  removeProviderConfig,
  getActiveProvider,
  setActiveProvider,
  testConnection
} from '../services/aiProviderService';

export interface AiKeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysUpdated?: () => void;
  onProviderChange?: () => void;
}

export const AiKeyManagerModal: React.FC<AiKeyManagerModalProps> = React.memo(({
  isOpen,
  onClose,
  onKeysUpdated,
  onProviderChange
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-4o');
  const [customModel, setCustomModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [configs, setConfigs] = useState<Record<AiProvider, AiProviderConfig | null>>(() => getProviderConfigs());
  const [activeConfig, setActiveConfig] = useState<AiProviderConfig | null>(() => getActiveProvider());

  // Carrega configurações quando o provedor selecionado muda ou ao abrir o modal
  const loadProviderConfig = useCallback((provider: AiProvider) => {
    const currentConfigs = getProviderConfigs();
    setConfigs(currentConfigs);
    setActiveConfig(getActiveProvider());

    const cfg = currentConfigs[provider];
    if (cfg) {
      setApiKey(cfg.apiKey || '');
      setModel(cfg.model || DEFAULT_PROVIDER_MODELS[provider][0]);
      setCustomModel(cfg.customModel || '');
      setBaseUrl(cfg.baseUrl || '');
    } else {
      setApiKey('');
      setModel(DEFAULT_PROVIDER_MODELS[provider][0]);
      setCustomModel('');
      setBaseUrl('');
    }
    setTestResult(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProviderConfig(selectedProvider);
    }
  }, [isOpen, selectedProvider, loadProviderConfig]);

  const notifyChange = () => {
    if (onKeysUpdated) onKeysUpdated();
    if (onProviderChange) onProviderChange();
  };

  const handleProviderSelect = (provider: AiProvider) => {
    setSelectedProvider(provider);
    loadProviderConfig(provider);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const effectiveModel = customModel.trim() || model;
    const result = await testConnection(selectedProvider, apiKey, effectiveModel, baseUrl.trim() || undefined);
    
    setTesting(false);
    setTestResult(result);
  };

  const handleSaveConfig = (activate: boolean = false) => {
    const effectiveModel = customModel.trim() || model;
    const newConfig: AiProviderConfig = {
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      model: effectiveModel,
      active: activate || (activeConfig?.provider === selectedProvider),
      baseUrl: baseUrl.trim() || undefined,
      customModel: customModel.trim() || undefined
    };

    saveProviderConfig(newConfig);

    if (activate) {
      setActiveProvider(selectedProvider);
    }

    const updatedConfigs = getProviderConfigs();
    setConfigs(updatedConfigs);
    const updatedActive = getActiveProvider();
    setActiveConfig(updatedActive);

    setTestResult({
      success: true,
      message: `Configuração do ${PROVIDER_DISPLAY_NAMES[selectedProvider]} salva com sucesso!`
    });

    notifyChange();
  };

  const handleRemoveConfig = () => {
    removeProviderConfig(selectedProvider);
    setApiKey('');
    setModel(DEFAULT_PROVIDER_MODELS[selectedProvider][0]);
    setCustomModel('');
    setBaseUrl('');
    setTestResult(null);

    const updatedConfigs = getProviderConfigs();
    setConfigs(updatedConfigs);
    setActiveConfig(getActiveProvider());

    notifyChange();
  };

  const handleToggleActivate = (provider: AiProvider) => {
    if (!configs[provider]?.apiKey) return;
    setActiveProvider(provider);
    setActiveConfig(getActiveProvider());
    setConfigs(getProviderConfigs());
    notifyChange();
  };

  if (!isOpen) return null;

  const currentProviderConfig = configs[selectedProvider];
  const isSelectedActive = activeConfig?.provider === selectedProvider;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200 text-slate-100 font-sans">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100">
                  Gerenciador de Chaves de API Multi-Provedor LLM
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> STRIX AUDIT BADGE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Suporte a OpenAI, Anthropic Claude, Google Gemini, Groq Cloud e OpenRouter para Text-to-CAD HVAC
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ACTIVE PROVIDER HIGHLIGHT BANNER */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg border ${activeConfig ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modo de Síntese 3D HVAC</div>
                <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  {activeConfig ? (
                    <>
                      <span className="text-emerald-400">Online LLM Active:</span>
                      <span>{PROVIDER_DISPLAY_NAMES[activeConfig.provider]} ({activeConfig.model})</span>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-400">Offline Fallback:</span>
                      <span>Parser de Regras Normativo ABNT NBR 16401</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {activeConfig && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                <Check className="w-3.5 h-3.5" /> Conectado ao LLM
              </span>
            )}
          </div>

          {/* PROVIDER SELECTION CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {(['openai', 'anthropic', 'gemini', 'groq', 'openrouter'] as AiProvider[]).map((prov) => {
              const hasKey = !!configs[prov]?.apiKey;
              const isActive = activeConfig?.provider === prov;
              const isSelected = selectedProvider === prov;

              return (
                <button
                  key={prov}
                  onClick={() => handleProviderSelect(prov)}
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500'
                      : hasKey
                      ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-bl-lg" title="Provedor Ativo" />
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs">{PROVIDER_DISPLAY_NAMES[prov].split(' ')[0]}</span>
                    {hasKey ? (
                      <Key className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    {hasKey ? (isActive ? '● Ativo' : '✓ Salvo') : 'Não configurado'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* CONFIGURATION FORM FOR SELECTED PROVIDER */}
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Configurar {PROVIDER_DISPLAY_NAMES[selectedProvider]}
              </h3>

              {currentProviderConfig?.apiKey && (
                <div className="flex items-center gap-2">
                  {!isSelectedActive ? (
                    <button
                      onClick={() => handleToggleActivate(selectedProvider)}
                      className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Ativar Provedor
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/30">
                      Provedor Ativo no Momento
                    </span>
                  )}

                  <button
                    onClick={handleRemoveConfig}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-colors"
                    title="Remover Chave de API"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* API KEY INPUT */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Chave de API ({PROVIDER_DISPLAY_NAMES[selectedProvider]})
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Cole sua chave de API para ${PROVIDER_DISPLAY_NAMES[selectedProvider]}`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* MODEL SELECTION & CUSTOM MODEL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Modelo Predefinido</label>
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setCustomModel('');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                >
                  {DEFAULT_PROVIDER_MODELS[selectedProvider].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Modelo Customizado (Opcional)</label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Ex: gpt-4o-mini-2024-07-18"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* CUSTOM ENDPOINT BASE URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Endpoint URL Customizado (Opcional)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={`Padrão: ${DEFAULT_BASE_URLS[selectedProvider]}`}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
              />
            </div>

            {/* TEST RESULT NOTIFICATION */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{testResult.message}</div>
                  {testResult.latencyMs && (
                    <div className="text-[10px] opacity-80 mt-0.5 font-mono">Latência de resposta: {testResult.latencyMs}ms</div>
                  )}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !apiKey.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300 font-semibold text-xs rounded-xl border border-cyan-500/30 shadow-md transition-all flex items-center gap-2"
              >
                {testing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <Server className="w-4 h-4 text-cyan-400" />
                )}
                {testing ? 'Testando Conexão...' : 'Testar Conexão'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveConfig(false)}
                disabled={!apiKey.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all"
              >
                Salvar Chave
              </button>

              <button
                type="button"
                onClick={() => handleSaveConfig(true)}
                disabled={!apiKey.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.25)] border border-cyan-300/30 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Salvar & Ativar Provedor
              </button>
            </div>
          </div>

          {/* FOOTER PRIVACY NOTICE */}
          <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Segurança Garantida: Chaves salvas apenas no LocalStorage do cliente e enviadas diretamente aos provedores oficiais de IA.
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors shrink-0"
            >
              Fechar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
});

AiKeyManagerModal.displayName = 'AiKeyManagerModal';
