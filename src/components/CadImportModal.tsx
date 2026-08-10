import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Upload,
  FileCode,
  Layers,
  Compass,
  Check,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Building2,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { HVACEnvironment, ActivityType } from '../types/hvac';
import {
  CADParseResult,
  CADPolygon,
  CADWindowItem,
  parseDXF,
  parseSVG,
  extractPolygonsFromEntities,
  extractWindowsFromEntities,
  convertCadToHVACEnvironments
} from '../services/cadImporterService';
import { HvacVectorCanvasEditor } from './HvacVectorCanvasEditor';

interface CadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedEnvironments: HVACEnvironment[], mode: 'append' | 'replace') => void;
}

export const CadImportModal: React.FC<CadImportModalProps> = React.memo(({
  isOpen,
  onClose,
  onImport
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'dxf' | 'svg' | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CADParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Configuration State
  const [wallLayers, setWallLayers] = useState<string[]>([]);
  const [windowLayers, setWindowLayers] = useState<string[]>([]);
  const [scaleFactor, setScaleFactor] = useState<number>(1.0); // 1 = m, 0.001 = mm, 0.01 = cm
  const [unitLabel, setUnitLabel] = useState<'m' | 'mm' | 'cm'>('m');
  const [defaultHeight, setDefaultHeight] = useState<number>(2.8);
  const [northAngleOffset, setNorthAngleOffset] = useState<number>(0);
  const [defaultActivity, setDefaultActivity] = useState<ActivityType>('comercial_baixo');
  const [defaultZonaId, setDefaultZonaId] = useState<number>(3);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Polygon & Windows State
  const [polygons, setPolygons] = useState<CADPolygon[]>([]);
  const [windows, setWindows] = useState<CADWindowItem[]>([]);
  const [hoveredPoly, setHoveredPoly] = useState<CADPolygon | null>(null);
  const [selectedPolyId, setSelectedPolyId] = useState<string | null>(null);

  // Process CAD text into layers & entities (Memoizado)
  const processCadContent = useCallback((content: string, type: 'dxf' | 'svg', scale: number) => {
    try {
      let result: CADParseResult;
      if (type === 'dxf') {
        result = parseDXF(content, scale);
      } else {
        result = parseSVG(content, scale);
      }

      setParseResult(result);

      // Auto-detect default layers
      const wallCandidateLayers: string[] = [];
      const windowCandidateLayers: string[] = [];

      result.layers.forEach((l) => {
        const nameLower = l.name.toLowerCase();
        if (
          nameLower.includes('parede') ||
          nameLower.includes('wall') ||
          nameLower.includes('ambiente') ||
          nameLower.includes('room') ||
          nameLower.includes('arquitetura') ||
          nameLower.includes('0')
        ) {
          wallCandidateLayers.push(l.name);
        } else if (
          nameLower.includes('janela') ||
          nameLower.includes('window') ||
          nameLower.includes('vidro') ||
          nameLower.includes('esquadria') ||
          nameLower.includes('glass')
        ) {
          windowCandidateLayers.push(l.name);
        }
      });

      setWallLayers(
        wallCandidateLayers.length > 0
          ? wallCandidateLayers
          : [result.layers[0]?.name || 'Default']
      );
      setWindowLayers(windowCandidateLayers);

      setStep(2);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao processar o arquivo CAD.');
    }
  }, []);

  // Handle File Upload (Memoizado)
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    let file: File | null = null;

    if ('files' in e.target && e.target.files?.[0]) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files?.[0]) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase();

    if (ext !== 'dxf' && ext !== 'svg') {
      setErrorMsg('Por favor, selecione um arquivo válido no formato .DXF ou .SVG');
      return;
    }

    setErrorMsg(null);
    setFileName(name);
    setFileType(ext as 'dxf' | 'svg');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      processCadContent(content, ext as 'dxf' | 'svg', scaleFactor);
    };
    reader.readAsText(file);
  }, [processCadContent, scaleFactor]);

  // Unit scale change (Memoizado)
  const handleUnitChange = useCallback((unit: 'm' | 'mm' | 'cm') => {
    setUnitLabel(unit);
    const scale = unit === 'mm' ? 0.001 : unit === 'cm' ? 0.01 : 1.0;
    setScaleFactor(scale);
    if (fileContent && fileType) {
      processCadContent(fileContent, fileType, scale);
    }
  }, [fileContent, fileType, processCadContent]);

  // Extract Polygons & Windows when layer config changes
  useEffect(() => {
    if (!parseResult) return;

    const extractedPolys = extractPolygonsFromEntities(parseResult.entities, wallLayers);
    const extractedWins = extractWindowsFromEntities(parseResult.entities, windowLayers);

    setPolygons(extractedPolys);
    setWindows(extractedWins);
  }, [parseResult, wallLayers, windowLayers]);

  // Final Import Action (Memoizado)
  const handleConfirmImport = useCallback(() => {
    const importedEnvs = convertCadToHVACEnvironments(polygons, windows, {
      wallLayerNames: wallLayers,
      windowLayerNames: windowLayers,
      defaultHeight,
      northAngleOffsetDegrees: northAngleOffset,
      scaleFactor,
      defaultActivity,
      defaultZonaId
    });

    if (importedEnvs.length === 0) {
      setErrorMsg('Nenhum ambiente válido foi detectado a partir dos layers selecionados.');
      return;
    }

    onImport(importedEnvs, importMode);
    onClose();
  }, [polygons, windows, wallLayers, windowLayers, defaultHeight, northAngleOffset, scaleFactor, defaultActivity, defaultZonaId, onImport, importMode, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-100">
                  Importador CAD de Plantas HVAC (DXF / SVG)
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/80 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PARAMETRIC CAD: SYNCED
                </span>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> STRIX AUDIT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Parsing vetorial de polígonos, cálculo de áreas por Shoelace e orientação solar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={`px-2.5 py-1 rounded-full ${step >= 1 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500'}`}>
                1. Upload
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2.5 py-1 rounded-full ${step >= 2 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500'}`}>
                2. De/Para Layers
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2.5 py-1 rounded-full ${step >= 3 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500'}`}>
                3. Preview & Importar
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload Dropzone */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center min-h-[380px] border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl bg-slate-950/40 p-8 text-center transition-all group">
              <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                Arraste seu arquivo CAD ou clique para selecionar
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-6">
                Suporta plantas baixas técnicas em arquivos vetoriais <strong>AutoCAD DXF (.dxf)</strong> ou <strong>SVG (.svg)</strong>.
              </p>

              <label className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm px-5 py-2.5 rounded-lg shadow-lg shadow-cyan-900/30 transition-all flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Selecionar Arquivo DXF / SVG
                <input
                  type="file"
                  accept=".dxf,.svg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400 border-t border-slate-800/80 pt-6 w-full max-w-lg">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Detecção de Polígonos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Shoelace Area Formula</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Normais de Parede</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Layer De/Para & Parameters */}
          {step === 2 && parseResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-200">{fileName}</div>
                    <div className="text-xs text-slate-400">
                      {parseResult.layers.length} layers detectados | {parseResult.entities.length} entidades vetoriais
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Trocar Arquivo
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* De/Para Layers Selector */}
                <div className="lg:col-span-2 space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Mapeamento De/Para de Layers CAD
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecione quais layers representam as paredes/perímetros dos ambientes e quais representam janelas/vidros.
                  </p>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {parseResult.layers.map((layer) => {
                      const isWall = wallLayers.includes(layer.name);
                      const isWin = windowLayers.includes(layer.name);

                      return (
                        <div
                          key={layer.name}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: layer.color }}
                            />
                            <span className="font-mono text-slate-200">{layer.name}</span>
                            <span className="text-slate-500">({layer.entityCount} elem)</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-cyan-400">
                              <input
                                type="checkbox"
                                checked={isWall}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setWallLayers((prev) => [...prev, layer.name]);
                                    setWindowLayers((prev) => prev.filter((w) => w !== layer.name));
                                  } else {
                                    setWallLayers((prev) => prev.filter((w) => w !== layer.name));
                                  }
                                }}
                                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                              />
                              Paredes/Ambientes
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-amber-400">
                              <input
                                type="checkbox"
                                checked={isWin}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setWindowLayers((prev) => [...prev, layer.name]);
                                    setWallLayers((prev) => prev.filter((w) => w !== layer.name));
                                  } else {
                                    setWindowLayers((prev) => prev.filter((w) => w !== layer.name));
                                  }
                                }}
                                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
                              />
                              Janelas/Vidros
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Import Parameters */}
                <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    Parâmetros de Importação
                  </h3>

                  {/* Unit Scale */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Unidade do Desenho CAD</label>
                    <select
                      value={unitLabel}
                      onChange={(e) => handleUnitChange(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="m">Metros (m)</option>
                      <option value="mm">Milímetros (mm)</option>
                      <option value="cm">Centímetros (cm)</option>
                    </select>
                  </div>

                  {/* Default Wall Height */}
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Pé-Direito Padrão (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.5"
                      max="12"
                      value={defaultHeight}
                      onChange={(e) => setDefaultHeight(parseFloat(e.target.value) || 2.8)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* North Angle Offset */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-medium flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        Orientação do Norte
                      </label>
                      <span className="text-cyan-400 font-mono">{northAngleOffset}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={northAngleOffset}
                      onChange={(e) => setNorthAngleOffset(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0° (+Y)</span>
                      <span>90° (+X)</span>
                      <span>180° (-Y)</span>
                      <span>270° (-X)</span>
                    </div>
                  </div>

                  {/* Mode & Action Buttons */}
                  <div className="pt-2">
                    <button
                      onClick={() => setStep(3)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2.5 rounded-lg shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      Avançar para Visualização 2D Canvas →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Interactive 2D Canvas & Summary */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Interactive 2D Canvas Viewport (Subcomponente Vector Canvas Otimizado) */}
              <div className="lg:col-span-2">
                <HvacVectorCanvasEditor
                  parseResult={parseResult}
                  polygons={polygons}
                  windows={windows}
                  wallLayers={wallLayers}
                  windowLayers={windowLayers}
                  hoveredPoly={hoveredPoly}
                  selectedPolyId={selectedPolyId}
                  northAngleOffset={northAngleOffset}
                  onHoverPoly={setHoveredPoly}
                  onSelectPolyId={setSelectedPolyId}
                />
              </div>

              {/* Detected Environments Summary & Import Options */}
              <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      Ambientes Encontrados
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono">
                      {polygons.length}
                    </span>
                  </h3>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {polygons.length === 0 ? (
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-xs text-center">
                        Nenhum polígono fechado encontrado nos layers selecionados.
                      </div>
                    ) : (
                      polygons.map((poly) => {
                        const isHovered = hoveredPoly?.id === poly.id;
                        const isSelected = selectedPolyId === poly.id;

                        return (
                          <div
                            key={poly.id}
                            onMouseEnter={() => setHoveredPoly(poly)}
                            onMouseLeave={() => setHoveredPoly(null)}
                            onClick={() => setSelectedPolyId(poly.id)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                                : isHovered
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between font-medium mb-1">
                              <span>{poly.name}</span>
                              <span className="font-mono text-cyan-400">{poly.area.toFixed(2)} m²</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Perímetro: {poly.perimeter.toFixed(1)}m</span>
                              <span>Pé-Direito: {defaultHeight}m</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Import Mode Options */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="text-xs font-medium text-slate-300">Modo de Inserção:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                        importMode === 'append'
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Adicionar aos Existentes
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                        importMode === 'replace'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Substituir Projeto
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-lg text-xs transition-colors"
                    >
                      ← Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={polygons.length === 0}
                      className="w-2/3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-xs shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Importar {polygons.length} Ambientes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CadImportModal.displayName = 'CadImportModal';
