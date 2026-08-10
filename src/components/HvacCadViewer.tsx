import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Sparkles, 
  Eye, 
  EyeOff, 
  Layers, 
  Maximize, 
  Download, 
  Box, 
  Compass, 
  RotateCcw, 
  FileCode,
  Zap,
  Info,
  CheckCircle2,
  Cpu,
  Key,
  RefreshCw,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { HVACEnvironment, HVACResult } from '../types/hvac';
import { ParsedGeometry, CameraPreset, HvacCadViewerProps } from '../types/cad';
import { parseTextToCadWithLlm } from '../services/textToCadService';
import { getActiveProvider, PROVIDER_DISPLAY_NAMES } from '../services/aiProviderService';
import { downloadDXFFile, downloadOBJFile } from '../services/cadExporterService';
import { calculateEnvironmentThermalLoad } from '../utils/hvacCalculations';
import { AiKeyManagerModal } from './AiKeyManagerModal';
import { defaultParametricCadSyncService } from '../services/parametricCadSyncService';

export const HvacCadViewer: React.FC<HvacCadViewerProps> = React.memo(({ 
  environment, 
  onEnvironmentUpdate 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Estados Interativos de Visualização 3D
  const [promptText, setPromptText] = useState<string>(
    `${environment.name}: ambiente de ${Math.sqrt(environment.area).toFixed(1)}x${Math.sqrt(environment.area).toFixed(1)}m com ${environment.height}m de pé-direito, ${environment.windows.length} janelas e ${environment.equipment.reduce((acc, e) => acc + e.qty, 0)} equipamentos.`
  );
  const [wallTransparency, setWallTransparency] = useState<boolean>(true);
  const [showRoof, setShowRoof] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [promptStatus, setPromptStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const promptStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (promptStatusTimeoutRef.current) {
        clearTimeout(promptStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return defaultParametricCadSyncService.subscribe((state, event) => {
      if (event.source === 'scene3d') return;
      if (event.type === '2d_updated' || event.type === 'simulation_updated' || event.type === 'full_sync') {
        const env = state.environments.find(e => e.id === environment.id);
        if (env && onEnvironmentUpdate) {
          onEnvironmentUpdate(env);
        }
      }
    });
  }, [environment.id, onEnvironmentUpdate]);

  // Infere ou calcula a geometria 3D
  const geometry: ParsedGeometry = useMemo(() => {
    const side = Math.sqrt(environment.area);
    const length = parseFloat(side.toFixed(2));
    const width = parseFloat(side.toFixed(2));
    const height = environment.height || 2.8;
    return {
      length,
      width,
      height,
      area: environment.area,
      volume: parseFloat((environment.area * height).toFixed(2))
    };
  }, [environment]);

  // Carga térmica para exibição no HUD
  const hvacCalcResult: HVACResult = useMemo(() => {
    return calculateEnvironmentThermalLoad(environment);
  }, [environment]);

  // Refs de Três.js para controle dinâmico de cena e câmera
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Inicialização e Renderização 3D Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // 1. Cena Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19); // Dark slate background
    sceneRef.current = scene;

    // 2. Câmera Perspectiva
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 3. Renderer WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Limpa o container antes de adicionar o canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Não passa do piso
    controlsRef.current = controls;

    // 5. Iluminação Industrial HVAC
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2); // Light cyan tint
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xf59e0b, 0.8, 20); // Warm light indoors
    pointLight.position.set(geometry.length / 2, geometry.height - 0.5, geometry.width / 2);
    scene.add(pointLight);

    // Grid de Referência no Piso
    const gridSize = Math.max(geometry.length, geometry.width) * 2;
    const gridHelper = new THREE.GridHelper(gridSize, 20, 0x06b6d4, 0x1e293b);
    gridHelper.position.set(geometry.length / 2, 0, geometry.width / 2);
    scene.add(gridHelper);

    // --- CONSTRUÇÃO DOS ELEMENTOS 3D DO AMBIENTE ---

    // A. Piso (Floor)
    const floorGeo = new THREE.PlaneGeometry(geometry.length, geometry.width);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      roughness: 0.4, 
      metalness: 0.2,
      side: THREE.DoubleSide 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(geometry.length / 2, 0, geometry.width / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // B. Paredes (Walls)
    const wallOpacity = wallTransparency ? 0.35 : 0.95;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Cyan-blue industrial wall
      transparent: true,
      opacity: wallOpacity,
      wireframe: wireframeMode,
      roughness: 0.3,
      side: THREE.DoubleSide
    });

    const wallThickness = 0.15;
    const L = geometry.length;
    const W = geometry.width;
    const H = geometry.height;

    // Parede Sul (Z = 0)
    const wallSouthGeo = new THREE.BoxGeometry(L, H, wallThickness);
    const wallSouth = new THREE.Mesh(wallSouthGeo, wallMat);
    wallSouth.position.set(L / 2, H / 2, 0);
    scene.add(wallSouth);

    // Parede Norte (Z = W)
    const wallNorthGeo = new THREE.BoxGeometry(L, H, wallThickness);
    const wallNorth = new THREE.Mesh(wallNorthGeo, wallMat);
    wallNorth.position.set(L / 2, H / 2, W);
    scene.add(wallNorth);

    // Parede Oeste (X = 0)
    const wallWestGeo = new THREE.BoxGeometry(wallThickness, H, W);
    const wallWest = new THREE.Mesh(wallWestGeo, wallMat);
    wallWest.position.set(0, H / 2, W / 2);
    scene.add(wallWest);

    // Parede Leste (X = L)
    const wallEastGeo = new THREE.BoxGeometry(wallThickness, H, W);
    const wallEast = new THREE.Mesh(wallEastGeo, wallMat);
    wallEast.position.set(L, H / 2, W / 2);
    scene.add(wallEast);

    // C. Janelas 3D (Windows)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      transmission: 0.9,
      thickness: 0.1
    });

    environment.windows.forEach((win) => {
      const winW = Math.min(L * 0.4, Math.max(1.2, win.area / 1.5));
      const winH = 1.2;
      const winGeo = new THREE.BoxGeometry(winW, winH, 0.2);
      const windowMesh = new THREE.Mesh(winGeo, glassMat);

      if (win.orientation === 'sul') {
        windowMesh.position.set(L / 2, H / 2, 0);
      } else if (win.orientation === 'norte') {
        windowMesh.position.set(L / 2, H / 2, W);
      } else if (win.orientation === 'leste') {
        windowMesh.rotation.y = Math.PI / 2;
        windowMesh.position.set(L, H / 2, W / 2);
      } else {
        windowMesh.rotation.y = Math.PI / 2;
        windowMesh.position.set(0, H / 2, W / 2);
      }
      scene.add(windowMesh);
    });

    // D. Telhado / Cobertura (Roof)
    if (showRoof && environment.hasRoof) {
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        transparent: true,
        opacity: 0.7,
        roughness: 0.5
      });
      const roofGeo = new THREE.BoxGeometry(L + 0.4, 0.2, W + 0.4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(L / 2, H + 0.1, W / 2);
      scene.add(roof);
    }

    // E. Equipamentos e Mobiliário 3D
    const equipMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const pcMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.3 });
    const acMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 });

    // Evaporadora Ar Condicionado (Wall AC Unit) no topo da parede Norte
    const acGeo = new THREE.BoxGeometry(1.2, 0.35, 0.3);
    const acUnit = new THREE.Mesh(acGeo, acMat);
    acUnit.position.set(L / 2, H - 0.3, W - 0.2);
    scene.add(acUnit);

    // Equipamentos Elétricos
    environment.equipment.forEach((eq, idx) => {
      const posX = 0.8 + (idx % 3) * 1.5;
      const posZ = 0.8 + Math.floor(idx / 3) * 1.5;

      if (posX < L - 0.8 && posZ < W - 0.8) {
        // Mesa / Rack Base
        const deskGeo = new THREE.BoxGeometry(0.8, 0.7, 0.6);
        const desk = new THREE.Mesh(deskGeo, equipMat);
        desk.position.set(posX, 0.35, posZ);
        desk.castShadow = true;
        scene.add(desk);

        // Monitor / Dispositivo em cima da mesa
        const devGeo = new THREE.BoxGeometry(0.4, 0.3, 0.1);
        const device = new THREE.Mesh(devGeo, pcMat);
        device.position.set(posX, 0.85, posZ);
        scene.add(device);
      }
    });

    // F. Ocupantes 3D (Representação Humanóide Minimalista)
    const personMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < Math.min(environment.occupants, 8); i++) {
      const pX = 1.0 + (i % 4) * 1.2;
      const pZ = W - 1.0 - Math.floor(i / 4) * 1.2;
      if (pX < L - 0.5 && pZ > 0.5) {
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
        const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const body = new THREE.Mesh(bodyGeo, personMat);
        const head = new THREE.Mesh(headGeo, personMat);
        body.position.set(pX, 0.6, pZ);
        head.position.set(pX, 1.35, pZ);
        scene.add(body);
        scene.add(head);
      }
    }

    // Posicionamento Inicial da Câmera (Perspectiva Isométrica)
    const maxDim = Math.max(L, W, H);
    camera.position.set(L * 1.8, H * 2.2, W * 2.2);
    controls.target.set(L / 2, H / 2, W / 2);
    controls.update();

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsividade do Canvas
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 500;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);

      // Descarte minucioso de Geometrias, Materiais e Texturas Three.js para evitar vazamentos em VRAM WebGL
      scene.traverse((object: any) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            });
          } else {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        }
      });

      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [environment, geometry, wallTransparency, showRoof, wireframeMode]);

  // Controles de Posição da Câmera
  const setCameraPreset = useCallback((preset: CameraPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const L = geometry.length;
    const W = geometry.width;
    const H = geometry.height;

    if (preset === 'iso') {
      camera.position.set(L * 1.8, H * 2.2, W * 2.2);
    } else if (preset === 'top') {
      camera.position.set(L / 2, Math.max(L, W) * 2.2, W / 2 + 0.01);
    } else if (preset === 'front') {
      camera.position.set(L / 2, H / 2, W * 2.8);
    }
    controls.target.set(L / 2, H / 2, W / 2);
    controls.update();
  }, [geometry]);

  // Executa o Parser Text-to-CAD (com suporte a LLM e fallback offline) ao submeter o Prompt
  const handleParsePrompt = useCallback(async () => {
    if (!promptText.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await parseTextToCadWithLlm(promptText, environment.id, environment.name);
      if (onEnvironmentUpdate) {
        onEnvironmentUpdate(result.environment);
      }
      if (promptStatusTimeoutRef.current) {
        clearTimeout(promptStatusTimeoutRef.current);
      }
      
      const sourceBadge = result.source === 'llm' 
        ? `Sintetizado via ${result.providerName || 'LLM'}` 
        : 'Sintetizado via Parser Offline NBR 16401';
        
      setPromptStatus(`Modelo CAD 3D gerado com sucesso! (${sourceBadge})`);
      promptStatusTimeoutRef.current = setTimeout(() => setPromptStatus(null), 5000);
    } catch (err: any) {
      setPromptStatus("Erro ao interpretar o prompt. Verifique os dados digitados.");
    } finally {
      setIsGenerating(false);
    }
  }, [promptText, environment.id, environment.name, onEnvironmentUpdate, isGenerating]);

  const activeProvider = useMemo(() => getActiveProvider(), [isAiModalOpen]);

  return (
    <div className="space-y-4">
      {/* TOOLBAR TEXT-TO-CAD PROMPT INPUT */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" /> Parser Text-to-CAD HVAC (Prompt para Modelo 3D)
          </label>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
              title="Gerenciar Chaves de API Multi-Provedor LLM"
            >
              <Key className="w-3 h-3 text-cyan-400" />
              {activeProvider ? (
                <span>AI: <strong className="text-emerald-400">{PROVIDER_DISPLAY_NAMES[activeProvider.provider].split(' ')[0]}</strong></span>
              ) : (
                <span className="text-slate-400">Configurar Chaves AI</span>
              )}
            </button>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">IA Geometry Synthesizer v2.0</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium transition-all"
            placeholder="Ex: Salão comercial de 10x8m com 3.5m de pé-direito, 2 janelas na parede leste e 10 computadores"
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleParsePrompt()}
            disabled={isGenerating}
          />
          <button
            onClick={handleParsePrompt}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 border border-cyan-300/30"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> Sintetizando via IA...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Gerar Modelo 3D
              </>
            )}
          </button>
        </div>

        {promptStatus && (
          <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {promptStatus}
          </div>
        )}
      </div>

      {/* VIEWPORT 3D CANVAS THREE.JS WITH OVERLAYS */}
      <div className="relative w-full h-[520px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Canvas Render Element */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* CONTROLES FLUTUANTES SUPERIORES (CONTROLES DE CÂMERA E RENDER) */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center gap-2 pointer-events-none">
          {/* HUD Info de Geometria */}
          <div className="bg-slate-900/95 border border-slate-800 p-3.5 rounded-xl shadow-lg backdrop-blur-md text-xs font-mono space-y-1.5 text-slate-200 pointer-events-auto">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-black text-cyan-400 text-xs uppercase tracking-wider">{environment.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PARAMETRIC CAD: SYNCED
                </span>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> STRIX AUDIT BADGE
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400">
              Dimensões: <span className="text-white font-bold">{geometry.length}m × {geometry.width}m × {geometry.height}m</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Área: <span className="text-white font-bold">{geometry.area} m²</span> | Volume: <span className="text-white font-bold">{geometry.volume} m³</span>
            </div>
          </div>

          {/* Botões de Ação Visual */}
          <div className="flex flex-wrap gap-1.5 pointer-events-auto bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/90 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setWallTransparency(!wallTransparency)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wallTransparency 
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Alternar Transparência das Paredes"
            >
              {wallTransparency ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {wallTransparency ? "Transparência ON" : "Transparência OFF"}
            </button>

            <button
              onClick={() => setShowRoof(!showRoof)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showRoof 
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Exibir/Ocultar Telhado"
            >
              <Box className="w-3.5 h-3.5" /> Telhado {showRoof ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => setWireframeMode(!wireframeMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wireframeMode 
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Modo Wireframe 3D"
            >
              <Layers className="w-3.5 h-3.5" /> Wireframe
            </button>
          </div>
        </div>

        {/* CONTROLES FLUTUANTES INFERIORES (CÂMERA PRESETS E EXPORTAÇÃO CAD) */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pointer-events-none">
          {/* Câmera Presets */}
          <div className="flex gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/90 shadow-lg backdrop-blur-md pointer-events-auto">
            <button
              onClick={() => setCameraPreset('iso')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
            >
              <Compass className="w-3 h-3 text-cyan-400" /> 3D Isométrica
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
            >
              <Maximize className="w-3 h-3 text-cyan-400" /> Planta 2D (Topo)
            </button>
            <button
              onClick={() => setCameraPreset('front')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" /> Vista Frontal
            </button>
          </div>

          {/* Botões de Exportação CAD (DXF e OBJ) */}
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => downloadDXFFile(environment, geometry)}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 shadow-lg transition-all flex items-center justify-center gap-1.5"
            >
              <FileCode className="w-4 h-4 text-cyan-400" /> Exportar DXF (AutoCAD)
            </button>
            <button
              onClick={() => downloadOBJFile(environment, geometry)}
              className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-1.5 border border-cyan-400/30"
            >
              <Download className="w-4 h-4" /> Exportar OBJ 3D
            </button>
          </div>
        </div>
      </div>

      {/* METRIC HUD CARD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Pico de Carga Térmica</span>
          <span className="text-base font-black text-cyan-400 font-mono">{hvacCalcResult.total.toLocaleString('pt-BR')} BTU/h</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Equipamento HVAC</span>
          <span className="text-xs font-bold text-slate-200">{hvacCalcResult.sugerida}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Janelas / Aberturas</span>
          <span className="text-base font-black text-slate-200 font-mono">{environment.windows.length} Esquadrias</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Carga de Equipamentos</span>
          <span className="text-base font-black text-slate-200 font-mono">{environment.equipment.reduce((sum, e) => sum + e.qty, 0)} Unidades</span>
        </div>
      </div>

      <AiKeyManagerModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
});

HvacCadViewer.displayName = 'HvacCadViewer';

