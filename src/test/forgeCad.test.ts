import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HVAC_BLOCK_LIBRARY,
  getHvacBlockLibrary,
  getHvacBlockById,
  getHvacBlocksByCategory,
  searchHvacBlocks,
  matchEquipmentToForgeBlock,
  generateHvacBlockGeometry,
  generateDxfBlockHeader,
  integrateEnvironmentWithForgeCad,
  parseTextToCadWithForge
} from '../services/forgeCadService';
import { saveProviderConfig, removeProviderConfig, AiProvider } from '../services/aiProviderService';
import { HVACEnvironment } from '../types/hvac';
import { ParsedGeometry } from '../types/cad';

describe('ForgeCAD Service & HVAC Industrial Geometries Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const providers: AiProvider[] = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter'];
    providers.forEach((p) => removeProviderConfig(p));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Catálogo Industrial de Blocos HVAC (ForgeCAD Library)', () => {
    it('deve retornar a biblioteca completa de blocos HVAC industriais', () => {
      const library = getHvacBlockLibrary();
      expect(library.length).toBeGreaterThanOrEqual(10);
      expect(library).toEqual(HVAC_BLOCK_LIBRARY);
    });

    it('deve buscar blocos específicos por ID', () => {
      const chiller = getHvacBlockById('chiller_water_cooled_100tr');
      expect(chiller).toBeDefined();
      expect(chiller?.name).toContain('Chiller Industrial');
      expect(chiller?.thermalCapacityBTU).toBe(1200000);

      const invalid = getHvacBlockById('inexistent_block_id');
      expect(invalid).toBeUndefined();
    });

    it('deve filtrar blocos por categoria HVAC', () => {
      const chillers = getHvacBlocksByCategory('chiller');
      expect(chillers.length).toBeGreaterThan(0);
      expect(chillers.every((b) => b.category === 'chiller')).toBe(true);

      const fancoils = getHvacBlocksByCategory('fancoil');
      expect(fancoils.length).toBeGreaterThan(0);
      expect(fancoils[0].id).toBe('ahu_fancoil_5000cfm');
    });

    it('deve realizar busca textual por palavras-chave', () => {
      const resultsChiller = searchHvacBlocks('chiller');
      expect(resultsChiller.length).toBeGreaterThan(0);

      const resultsRack = searchHvacBlocks('servidor');
      expect(resultsRack.length).toBeGreaterThan(0);
      expect(resultsRack[0].id).toBe('server_rack_42u');

      const all = searchHvacBlocks('   ');
      expect(all.length).toBe(HVAC_BLOCK_LIBRARY.length);
    });

    it('deve mapear equipamentos genéricos de ambiente para blocos ForgeCAD apropriados', () => {
      const itemChiller = { id: 1, name: 'Chiller de Água Gelada', watts: 50000, qty: 1 };
      const blockChiller = matchEquipmentToForgeBlock(itemChiller);
      expect(blockChiller.category).toBe('chiller');

      const itemServer = { id: 2, name: 'Servidor Blade Rack', watts: 400, qty: 5 };
      const blockServer = matchEquipmentToForgeBlock(itemServer);
      expect(blockServer.category).toBe('server_rack');
    });
  });

  describe('2. Geração e Transformação de Geometria CAD 2D/3D', () => {
    it('deve gerar geometria 2D e malha 3D transladada para a posição especificada', () => {
      const geom = generateHvacBlockGeometry('split_evap_24000btu', { x: 5, y: 10 });

      expect(geom.entities2D.length).toBeGreaterThan(0);
      expect(geom.entities2D[0].points[0].x).toBe(5);
      expect(geom.entities2D[0].points[0].y).toBe(10);
      expect(geom.obj3DMeshSnippet).toContain('o Block_split_evap_24000btu');
      expect(geom.obj3DMeshSnippet).toContain('v 5 0 10');
    });

    it('deve aplicar rotação em graus aos vértices CAD 2D', () => {
      const geom0 = generateHvacBlockGeometry('split_evap_24000btu', { x: 0, y: 0 }, { rotationDegrees: 0 });
      const geom90 = generateHvacBlockGeometry('split_evap_24000btu', { x: 0, y: 0 }, { rotationDegrees: 90 });

      expect(geom0.entities2D[0].points[1].x).toBeCloseTo(1.1, 1);
      expect(geom0.entities2D[0].points[1].y).toBeCloseTo(0, 1);

      // Com rotação 90°, (1.1, 0) vira aproximadamente (0, 1.1)
      expect(geom90.entities2D[0].points[1].x).toBeCloseTo(0, 1);
      expect(geom90.entities2D[0].points[1].y).toBeCloseTo(1.1, 1);
    });

    it('deve gerar cabeçalho de blocos DXF (BLOCKS / ENDBLK)', () => {
      const dxfBlocks = generateDxfBlockHeader();
      expect(dxfBlocks).toContain('SECTION');
      expect(dxfBlocks).toContain('BLOCKS');
      expect(dxfBlocks).toContain('CHILLER_WATER_COOLED_100TR');
      expect(dxfBlocks).toContain('ENDBLK');
      expect(dxfBlocks).toContain('ENDSEC');
    });
  });

  describe('3. Integração ForgeCAD com Ambientes HVAC', () => {
    const sampleEnv: HVACEnvironment = {
      id: 'env-forge-test',
      name: 'Central de TI e Servidores',
      area: 50,
      height: 3.0,
      occupants: 3,
      activity: 'comercial_baixo',
      zonaId: 3,
      lightingWatts: 600,
      hasRoof: true,
      roofType: 'laje_isolada',
      roofArea: 50,
      walls: [
        { id: 1, area: 30, orientation: 'norte', type: 'alvenaria_pesada' }
      ],
      windows: [],
      equipment: [
        { id: 1, name: 'Servidor Rack 42U', watts: 4500, qty: 2 },
        { id: 2, name: 'Unidade Fan Coil Central', watts: 5500, qty: 1 }
      ]
    };

    const sampleGeom: ParsedGeometry = {
      length: 10.0,
      width: 5.0,
      height: 3.0,
      area: 50,
      volume: 150
    };

    it('deve converter ambiente e equipamentos em modelo ForgeCAD parametrizado', () => {
      const forgeModel = integrateEnvironmentWithForgeCad(sampleEnv, sampleGeom);

      expect(forgeModel.placements.length).toBe(2);
      expect(forgeModel.entities2D.length).toBeGreaterThan(0);
      expect(forgeModel.obj3DMesh).toContain('ForgeCAD 3D Environment Model: Central de TI e Servidores');
      expect(forgeModel.dxfBlockHeader).toContain('BLOCKS');
      expect(forgeModel.totalElectricLoadWatts).toBe(4500 * 2 + 5500 * 1);
      expect(forgeModel.totalEquipmentCoolingBTU).toBeGreaterThan(0);
    });
  });

  describe('4. Pipeline Text-to-CAD + Multi-IA Provedor + ForgeCAD (parseTextToCadWithForge)', () => {
    it('deve sintetizar ambiente via LLM ativo (OpenAI) e integrar blocos ForgeCAD', async () => {
      saveProviderConfig({
        provider: 'openai',
        apiKey: 'sk-forge-valid-key',
        model: 'gpt-4o',
        active: true
      });

      const mockLlmJsonResponse = JSON.stringify({
        environment: {
          name: 'Data Center Forge',
          area: 80,
          height: 3.5,
          occupants: 2,
          activity: 'comercial_alto',
          zonaId: 3,
          lightingWatts: 800,
          hasRoof: true,
          roofType: 'laje_isolada',
          roofArea: 80,
          walls: [
            { id: 1, area: 35, orientation: 'norte', type: 'alvenaria_pesada' }
          ],
          windows: [],
          equipment: [
            { id: 1, name: 'Rack Servidor 42U', watts: 4500, qty: 4 },
            { id: 2, name: 'Chiller Água Gelada', watts: 85000, qty: 1 }
          ]
        },
        geometry: {
          length: 10,
          width: 8,
          height: 3.5,
          area: 80,
          volume: 280
        },
        warnings: []
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockLlmJsonResponse } }]
        })
      } as Response);

      const result = await parseTextToCadWithForge('Data Center de 10x8m com 4 racks e 1 chiller');

      expect(result.source).toBe('llm');
      expect(result.providerName).toBe('OpenAI');
      expect(result.environment.name).toBe('Data Center Forge');
      expect(result.forgeCadGeom.placements.length).toBe(2);
      expect(result.forgeCadGeom.totalElectricLoadWatts).toBe(4500 * 4 + 85000 * 1);
    });

    it('deve usar o parser offline normativo quando forceOffline = true', async () => {
      const result = await parseTextToCadWithForge(
        'Sala de reuniões 6x5m com 3 computadores',
        undefined,
        undefined,
        true
      );

      expect(result.source).toBe('offline');
      expect(result.geometry.area).toBe(30);
      expect(result.forgeCadGeom.placements.length).toBeGreaterThan(0);
      expect(result.forgeCadGeom.entities2D.length).toBeGreaterThan(0);
    });
  });
});
