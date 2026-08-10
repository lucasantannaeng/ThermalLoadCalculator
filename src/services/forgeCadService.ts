import { HVACEnvironment, Equipment } from '../types/hvac';
import { CADPoint, CADEntity, ParsedGeometry, TextToCadResult } from '../types/cad';
import { parseTextToCadWithLlm, parseTextToCad } from './textToCadService';
import { getActiveProvider, PROVIDER_DISPLAY_NAMES } from './aiProviderService';

export type HvacBlockCategory = 
  | 'chiller' 
  | 'fancoil' 
  | 'split_evap' 
  | 'split_cond' 
  | 'rooftop' 
  | 'cooling_tower' 
  | 'duct_segment' 
  | 'diffuser' 
  | 'server_rack' 
  | 'compressor';

export interface HvacBlockDefinition {
  id: string;
  name: string;
  category: HvacBlockCategory;
  thermalCapacityBTU: number;
  electricPowerWatts: number;
  airFlowCFM?: number;
  dimensions: {
    length: number; // m (eixo X)
    width: number;  // m (eixo Y / Z em 3D)
    height: number; // m (eixo Z / Y altura)
  };
  description: string;
  symbol2D: {
    type: 'rect' | 'circle' | 'custom';
    color: string;
    label: string;
  };
  cadEntities: CADEntity[];
  objMeshSnippet?: string;
}

export interface ForgeCadPlacement {
  id: string;
  blockId: string;
  blockName: string;
  category: HvacBlockCategory;
  position: { x: number; y: number; z: number };
  rotationDegrees: number;
  scale: number;
  dimensions: { length: number; width: number; height: number };
  electricPowerWatts: number;
  thermalCapacityBTU: number;
  qty: number;
}

export interface ForgeCadGeometry {
  placements: ForgeCadPlacement[];
  entities2D: CADEntity[];
  obj3DMesh: string;
  dxfBlockHeader: string;
  totalElectricLoadWatts: number;
  totalEquipmentCoolingBTU: number;
}

export interface ForgeCadEnvironmentModel {
  environment: HVACEnvironment;
  geometry: ParsedGeometry;
  forgeCadGeom: ForgeCadGeometry;
  warnings: string[];
  source?: 'llm' | 'offline';
  providerName?: string;
}

/**
 * Catálogo industrial de blocos e geometrias CAD de equipamentos HVAC (ForgeCAD).
 */
export const HVAC_BLOCK_LIBRARY: HvacBlockDefinition[] = [
  {
    id: 'chiller_water_cooled_100tr',
    name: 'Chiller Industrial Água Gelada (100 TR)',
    category: 'chiller',
    thermalCapacityBTU: 1200000,
    electricPowerWatts: 85000,
    airFlowCFM: 0,
    dimensions: { length: 3.5, width: 1.6, height: 2.0 },
    description: 'Chiller parafuso resfriado a água de alta eficiência para grandes centrais de climatização.',
    symbol2D: { type: 'rect', color: '#0284c7', label: 'CHL-100TR' },
    cadEntities: [
      {
        id: 'chl-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 3.5, y: 0 }, { x: 3.5, y: 1.6 }, { x: 0, y: 1.6 }],
        closed: true,
        name: 'Chiller Body'
      },
      {
        id: 'chl-2',
        type: 'CIRCLE',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0.8, y: 0.8 }, { x: 2.7, y: 0.8 }],
        closed: true,
        name: 'Compressor Heads'
      }
    ]
  },
  {
    id: 'ahu_fancoil_5000cfm',
    name: 'Fan Coil AHU Central (5.000 CFM)',
    category: 'fancoil',
    thermalCapacityBTU: 180000,
    electricPowerWatts: 5500,
    airFlowCFM: 5000,
    dimensions: { length: 2.2, width: 1.4, height: 1.5 },
    description: 'Unidade Tratadora de Ar (AHU) modular com filtro HEPA e serpentina de água gelada.',
    symbol2D: { type: 'rect', color: '#06b6d4', label: 'AHU-5000' },
    cadEntities: [
      {
        id: 'ahu-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 2.2, y: 0 }, { x: 2.2, y: 1.4 }, { x: 0, y: 1.4 }],
        closed: true,
        name: 'AHU Main Housing'
      }
    ]
  },
  {
    id: 'split_evap_24000btu',
    name: 'Evaporadora Split Hi-Wall (24.000 BTU/h)',
    category: 'split_evap',
    thermalCapacityBTU: 24000,
    electricPowerWatts: 2100,
    airFlowCFM: 750,
    dimensions: { length: 1.1, width: 0.35, height: 0.3 },
    description: 'Evaporadora mural para escritórios e salas comerciais de médio porte.',
    symbol2D: { type: 'rect', color: '#3b82f6', label: 'EVAP-24K' },
    cadEntities: [
      {
        id: 'evap-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 1.1, y: 0 }, { x: 1.1, y: 0.35 }, { x: 0, y: 0.35 }],
        closed: true,
        name: 'Evaporator Unit'
      }
    ]
  },
  {
    id: 'split_cond_24000btu',
    name: 'Condensadora Split Descarga Horizontal (24.000 BTU/h)',
    category: 'split_cond',
    thermalCapacityBTU: 24000,
    electricPowerWatts: 2200,
    dimensions: { length: 0.9, width: 0.4, height: 0.7 },
    description: 'Unidade condensadora externa leve com ventilador axial.',
    symbol2D: { type: 'rect', color: '#f59e0b', label: 'COND-24K' },
    cadEntities: [
      {
        id: 'cond-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 0.9, y: 0 }, { x: 0.9, y: 0.4 }, { x: 0, y: 0.4 }],
        closed: true,
        name: 'Condenser Outer Frame'
      },
      {
        id: 'cond-fan',
        type: 'CIRCLE',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0.45, y: 0.2 }],
        closed: true,
        name: 'Axial Fan'
      }
    ]
  },
  {
    id: 'rooftop_central_15tr',
    name: 'Unidade Rooftop Central (15 TR)',
    category: 'rooftop',
    thermalCapacityBTU: 180000,
    electricPowerWatts: 14000,
    airFlowCFM: 6000,
    dimensions: { length: 2.8, width: 1.8, height: 1.4 },
    description: 'Equipamento autônomo monobloco para cobertura de galpões e supermercados.',
    symbol2D: { type: 'rect', color: '#10b981', label: 'ROOFTOP-15TR' },
    cadEntities: [
      {
        id: 'rt-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 2.8, y: 0 }, { x: 2.8, y: 1.8 }, { x: 0, y: 1.8 }],
        closed: true,
        name: 'Rooftop Package Unit'
      }
    ]
  },
  {
    id: 'cooling_tower_200tr',
    name: 'Torre de Resfriamento em Fibra (200 TR)',
    category: 'cooling_tower',
    thermalCapacityBTU: 2400000,
    electricPowerWatts: 7500,
    dimensions: { length: 2.5, width: 2.5, height: 3.2 },
    description: 'Torre de resfriamento de água em circuito aberto para chillers industriais.',
    symbol2D: { type: 'circle', color: '#6366f1', label: 'TOWER-200TR' },
    cadEntities: [
      {
        id: 'ct-1',
        type: 'CIRCLE',
        layer: 'EQUIPAMENTOS_HVAC',
        points: [{ x: 1.25, y: 1.25 }],
        closed: true,
        name: 'Cooling Tower Cylinder'
      }
    ]
  },
  {
    id: 'duct_main_branch',
    name: 'Trecho de Duto Retangular Mestre (600x400mm)',
    category: 'duct_segment',
    thermalCapacityBTU: 0,
    electricPowerWatts: 0,
    airFlowCFM: 2500,
    dimensions: { length: 2.0, width: 0.6, height: 0.4 },
    description: 'Segmento de duto de chapa galvanizada isolado com lã de vidro para distribuição de ar.',
    symbol2D: { type: 'rect', color: '#94a3b8', label: 'DUCT-60x40' },
    cadEntities: [
      {
        id: 'duct-1',
        type: 'RECT',
        layer: 'DUTOS_HVAC',
        points: [{ x: 0, y: 0 }, { x: 2.0, y: 0 }, { x: 2.0, y: 0.6 }, { x: 0, y: 0.6 }],
        closed: true,
        name: 'Duct Segment'
      }
    ]
  },
  {
    id: 'diffuser_square_4way',
    name: 'Difusor de Ar Quadrado 4 Vias (600x600mm)',
    category: 'diffuser',
    thermalCapacityBTU: 0,
    electricPowerWatts: 0,
    airFlowCFM: 400,
    dimensions: { length: 0.6, width: 0.6, height: 0.1 },
    description: 'Grelha difusora de teto em alumínio para distribuição uniforme de ar insuflado.',
    symbol2D: { type: 'rect', color: '#ec4899', label: 'DIF-60x60' },
    cadEntities: [
      {
        id: 'dif-1',
        type: 'RECT',
        layer: 'DIFUSORES_HVAC',
        points: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 0.6, y: 0.6 }, { x: 0, y: 0.6 }],
        closed: true,
        name: 'Diffuser Outer'
      }
    ]
  },
  {
    id: 'server_rack_42u',
    name: 'Rack de Servidores 42U High-Density',
    category: 'server_rack',
    thermalCapacityBTU: 0,
    electricPowerWatts: 4500,
    dimensions: { length: 0.8, width: 1.1, height: 2.0 },
    description: 'Gabinete fechado de TI com dissipação térmica contínua de alto fluxo.',
    symbol2D: { type: 'rect', color: '#8b5cf6', label: 'RACK-42U' },
    cadEntities: [
      {
        id: 'rack-1',
        type: 'RECT',
        layer: 'EQUIPAMENTOS_TI',
        points: [{ x: 0, y: 0 }, { x: 0.8, y: 0 }, { x: 0.8, y: 1.1 }, { x: 0, y: 1.1 }],
        closed: true,
        name: 'Server Rack Frame'
      }
    ]
  },
  {
    id: 'compressor_scroll_10hp',
    name: 'Compressor Scroll Hermético (10 HP)',
    category: 'compressor',
    thermalCapacityBTU: 120000,
    electricPowerWatts: 9000,
    dimensions: { length: 0.5, width: 0.5, height: 0.6 },
    description: 'Compressor de alta eficiência de fluido refrigerante R410A / R32.',
    symbol2D: { type: 'circle', color: '#ef4444', label: 'COMP-10HP' },
    cadEntities: [
      {
        id: 'comp-1',
        type: 'CIRCLE',
        layer: 'COMPRESSORES_HVAC',
        points: [{ x: 0.25, y: 0.25 }],
        closed: true,
        name: 'Scroll Body'
      }
    ]
  }
];

/**
 * Retorna todo o catálogo industrial de blocos ForgeCAD.
 */
export function getHvacBlockLibrary(): HvacBlockDefinition[] {
  return HVAC_BLOCK_LIBRARY;
}

/**
 * Busca um bloco industrial de HVAC por ID.
 */
export function getHvacBlockById(id: string): HvacBlockDefinition | undefined {
  return HVAC_BLOCK_LIBRARY.find((b) => b.id === id);
}

/**
 * Filtra blocos por categoria (ex: chiller, fancoil, split_evap, etc.).
 */
export function getHvacBlocksByCategory(category: HvacBlockCategory): HvacBlockDefinition[] {
  return HVAC_BLOCK_LIBRARY.filter((b) => b.category === category);
}

/**
 * Busca blocos por termo textual de pesquisa.
 */
export function searchHvacBlocks(query: string): HvacBlockDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return HVAC_BLOCK_LIBRARY;
  return HVAC_BLOCK_LIBRARY.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q)
  );
}

/**
 * Mapeia um item de equipamento básico (ex: da lista do ambiente) para o bloco ForgeCAD mais apropriado.
 */
export function matchEquipmentToForgeBlock(item: Equipment): HvacBlockDefinition {
  const name = item.name.toLowerCase();
  if (name.includes('chiller')) return getHvacBlockById('chiller_water_cooled_100tr')!;
  if (name.includes('fan coil') || name.includes('fancoil') || name.includes('ahu')) return getHvacBlockById('ahu_fancoil_5000cfm')!;
  if (name.includes('condensador') || name.includes('condensadora')) return getHvacBlockById('split_cond_24000btu')!;
  if (name.includes('rooftop')) return getHvacBlockById('rooftop_central_15tr')!;
  if (name.includes('torre') || name.includes('cooling tower')) return getHvacBlockById('cooling_tower_200tr')!;
  if (name.includes('rack') || name.includes('servidor')) return getHvacBlockById('server_rack_42u')!;
  if (name.includes('compressor')) return getHvacBlockById('compressor_scroll_10hp')!;
  if (name.includes('duto')) return getHvacBlockById('duct_main_branch')!;
  if (name.includes('difusor') || name.includes('grelha')) return getHvacBlockById('diffuser_square_4way')!;

  // Fallback padrão: Evaporadora Split se for HVAC, ou Rack se for TI
  return item.watts > 1000 ? getHvacBlockById('split_evap_24000btu')! : getHvacBlockById('server_rack_42u')!;
}

/**
 * Gera as entidades 2D CAD e a malha 3D OBJ posicionadas para um bloco ForgeCAD específico.
 */
export function generateHvacBlockGeometry(
  blockId: string,
  position: CADPoint,
  options: { rotationDegrees?: number; scale?: number } = {}
): { entities2D: CADEntity[]; obj3DMeshSnippet: string } {
  const block = getHvacBlockById(blockId);
  if (!block) {
    throw new Error(`Bloco ForgeCAD '${blockId}' não encontrado.`);
  }

  const rot = options.rotationDegrees || 0;
  const scale = options.scale || 1.0;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const transformPoint = (pt: CADPoint): CADPoint => {
    const sx = pt.x * scale;
    const sy = pt.y * scale;
    const rx = sx * cos - sy * sin;
    const ry = sx * sin + sy * cos;
    return {
      x: parseFloat((position.x + rx).toFixed(3)),
      y: parseFloat((position.y + ry).toFixed(3))
    };
  };

  const entities2D: CADEntity[] = block.cadEntities.map((ent, idx) => ({
    id: `${blockId}-${ent.id}-${Math.random().toString(36).substring(2, 6)}`,
    type: ent.type,
    layer: ent.layer || 'EQUIPAMENTOS_HVAC',
    points: ent.points.map(transformPoint),
    closed: ent.closed,
    name: ent.name
  }));

  // Malha 3D em Wavefront OBJ
  const L = block.dimensions.length * scale;
  const W = block.dimensions.width * scale;
  const H = block.dimensions.height * scale;
  const px = position.x;
  const py = position.y;

  const obj3DMeshSnippet = `# ForgeCAD Block 3D Mesh: ${block.name}
o Block_${block.id}
v ${px} 0 ${py}
v ${px + L} 0 ${py}
v ${px + L} 0 ${py + W}
v ${px} 0 ${py + W}
v ${px} ${H} ${py}
v ${px + L} ${H} ${py}
v ${px + L} ${H} ${py + W}
v ${px} ${H} ${py + W}
vn 0 1 0
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
f 5 6 7 8
`;

  return { entities2D, obj3DMeshSnippet };
}

/**
 * Gera a seção de blocos para arquivos DXF (AutoCAD BLOCK/ENDBLK).
 */
export function generateDxfBlockHeader(blocks: HvacBlockDefinition[] = HVAC_BLOCK_LIBRARY): string {
  let dxf = `0
SECTION
2
BLOCKS
`;

  blocks.forEach((blk) => {
    dxf += `0
BLOCK
8
0
2
${blk.id.toUpperCase()}
70
0
10
0.0
20
0.0
30
0.0
`;
    blk.cadEntities.forEach((ent) => {
      if (ent.points.length >= 2) {
        dxf += `0
LINE
8
${ent.layer}
10
${ent.points[0].x.toFixed(3)}
20
${ent.points[0].y.toFixed(3)}
30
0.0
11
${ent.points[1].x.toFixed(3)}
21
${ent.points[1].y.toFixed(3)}
31
0.0
`;
      }
    });

    dxf += `0
ENDBLK
8
0
`;
  });

  dxf += `0
ENDSEC
`;
  return dxf;
}

/**
 * Integra um HVACEnvironment e suas dimensões com o ecossistema ForgeCAD.
 * Mapeia todos os equipamentos para blocos ForgeCAD industriais e compõe geometrias 2D e 3D.
 */
export function integrateEnvironmentWithForgeCad(
  environment: HVACEnvironment,
  geometry: ParsedGeometry
): ForgeCadGeometry {
  const placements: ForgeCadPlacement[] = [];
  const entities2D: CADEntity[] = [];
  let obj3DMesh = `# ForgeCAD 3D Environment Model: ${environment.name}\n`;
  let totalElectricWatts = 0;
  let totalCoolingBTU = 0;

  const margin = 0.8;
  const envL = geometry.length;
  const envW = geometry.width;

  environment.equipment.forEach((item, idx) => {
    const block = matchEquipmentToForgeBlock(item);
    const posX = margin + (idx % 3) * (block.dimensions.length + 0.6);
    const posY = margin + Math.floor(idx / 3) * (block.dimensions.width + 0.6);

    // Evita posicionamento fora das paredes do ambiente
    const safeX = Math.min(envL - block.dimensions.length - 0.2, Math.max(0.2, posX));
    const safeY = Math.min(envW - block.dimensions.width - 0.2, Math.max(0.2, posY));

    const placement: ForgeCadPlacement = {
      id: `forge-placement-${idx + 1}`,
      blockId: block.id,
      blockName: block.name,
      category: block.category,
      position: { x: parseFloat(safeX.toFixed(2)), y: parseFloat(safeY.toFixed(2)), z: 0 },
      rotationDegrees: 0,
      scale: 1.0,
      dimensions: block.dimensions,
      electricPowerWatts: item.watts * item.qty,
      thermalCapacityBTU: block.thermalCapacityBTU * item.qty,
      qty: item.qty
    };

    placements.push(placement);
    totalElectricWatts += placement.electricPowerWatts;
    totalCoolingBTU += placement.thermalCapacityBTU;

    const blockGeom = generateHvacBlockGeometry(block.id, { x: safeX, y: safeY });
    entities2D.push(...blockGeom.entities2D);
    obj3DMesh += blockGeom.obj3DMeshSnippet + '\n';
  });

  const dxfBlockHeader = generateDxfBlockHeader(
    HVAC_BLOCK_LIBRARY.filter((b) => placements.some((p) => p.blockId === b.id))
  );

  return {
    placements,
    entities2D,
    obj3DMesh,
    dxfBlockHeader,
    totalElectricLoadWatts: totalElectricWatts,
    totalEquipmentCoolingBTU: totalCoolingBTU
  };
}

/**
 * Pipeline completo inteligente: Text-to-CAD + Multi-IA + ForgeCAD Industrial Blocks.
 * Suporta provedores LLM ativos (OpenAI, Anthropic, Gemini, Groq, OpenRouter) com fallback offline normativo.
 */
export async function parseTextToCadWithForge(
  prompt: string,
  existingEnvId?: string,
  existingEnvName?: string,
  forceOffline: boolean = false
): Promise<ForgeCadEnvironmentModel> {
  // 1. Invoca parser inteligente Text-to-CAD com suporte a LLM Multi-Provedor
  const textToCadResult: TextToCadResult = await parseTextToCadWithLlm(
    prompt,
    existingEnvId,
    existingEnvName,
    forceOffline
  );

  // 2. Processa e integra geometrias e blocos ForgeCAD
  const forgeCadGeom = integrateEnvironmentWithForgeCad(
    textToCadResult.environment,
    textToCadResult.geometry
  );

  const activeConfig = getActiveProvider();
  const providerName = activeConfig ? PROVIDER_DISPLAY_NAMES[activeConfig.provider] : undefined;

  return {
    environment: textToCadResult.environment,
    geometry: textToCadResult.geometry,
    forgeCadGeom,
    warnings: textToCadResult.warnings,
    source: textToCadResult.source,
    providerName: textToCadResult.providerName || providerName
  };
}
