import { describe, it, expect } from 'vitest';
import { parseTextToCad } from '../services/textToCadService';
import { exportToDXF, exportToOBJ } from '../services/cadExporterService';
import { HVACEnvironment } from '../types/hvac';
import { TextToCadResult } from '../types/cad';

describe('HVAC 3D CAD Integration & Text-to-CAD Engine', () => {

  it('deve converter o prompt descritivo em um ambiente e geometria parametrizados (Prompt 1: Salão comercial 10x8m)', () => {
    const prompt = 'Salão comercial de 10x8m com 3.5m de pé-direito, 2 janelas na parede leste e 10 computadores';
    const result: TextToCadResult = parseTextToCad(prompt);

    expect(result).toBeDefined();
    expect(result.geometry.length).toBe(10);
    expect(result.geometry.width).toBe(8);
    expect(result.geometry.height).toBe(3.5);
    expect(result.geometry.area).toBe(80);
    expect(result.geometry.volume).toBe(280);

    expect(result.environment.activity).toBe('comercial_alto');
    expect(result.environment.windows.length).toBeGreaterThanOrEqual(2);
    expect(result.environment.windows[0].orientation).toBe('leste');

    const pcEquip = result.environment.equipment.find(e => e.name.includes('Computador'));
    expect(pcEquip).toBeDefined();
    expect(pcEquip?.qty).toBe(10);
    expect(pcEquip?.watts).toBe(300);
  });

  it('deve converter prompt residencial com pé-direito e ocupantes (Prompt 2: Quarto 4x5m)', () => {
    const prompt = 'Quarto de 4x5m com 2.8m de pé direito, 1 janela ao sul, 2 pessoas e 1 ar condicionado';
    const result = parseTextToCad(prompt);

    expect(result.geometry.length).toBe(4);
    expect(result.geometry.width).toBe(5);
    expect(result.geometry.height).toBe(2.8);
    expect(result.geometry.area).toBe(20);

    expect(result.environment.activity).toBe('residencial');
    expect(result.environment.occupants).toBe(2);

    const winSouth = result.environment.windows.find(w => w.orientation === 'sul');
    expect(winSouth).toBeDefined();

    const acEquip = result.environment.equipment.find(e => e.name.includes('HVAC') || e.name.includes('Evaporadora'));
    expect(acEquip).toBeDefined();
    expect(acEquip?.qty).toBe(1);
  });

  it('deve gerar arquivo AutoCAD DXF válido estruturado por camadas', () => {
    const env: HVACEnvironment = {
      id: 'env-test-dxf',
      name: 'Auditório Principal',
      area: 60,
      height: 3.5,
      occupants: 40,
      activity: 'comercial_alto',
      zonaId: 3,
      lightingWatts: 600,
      hasRoof: true,
      roofType: 'laje_isolada',
      roofArea: 60,
      walls: [
        { id: 1, area: 35, orientation: 'norte', type: 'alvenaria_pesada' }
      ],
      windows: [
        { id: 1, area: 4, orientation: 'sul', glassType: 'duplo', protection: 0.6 }
      ],
      equipment: [
        { id: 1, name: 'Projetor Multimídia High Lumen', watts: 350, qty: 2 }
      ]
    };

    const dxfString = exportToDXF(env);

    expect(typeof dxfString).toBe('string');
    expect(dxfString.length).toBeGreaterThan(500);

    // Valida seções fundamentais do padrão DXF
    expect(dxfString).toContain('SECTION');
    expect(dxfString).toContain('HEADER');
    expect(dxfString).toContain('TABLES');
    expect(dxfString).toContain('ENTITIES');
    expect(dxfString).toContain('PAREDES');
    expect(dxfString).toContain('JANELAS');
    expect(dxfString).toContain('EQUIPAMENTOS');
    expect(dxfString).toContain('ANOTACOES');
    expect(dxfString).toContain('EOF');
  });

  it('deve gerar modelo 3D Wavefront OBJ com malhas de piso, paredes e equipamentos', () => {
    const env: HVACEnvironment = {
      id: 'env-test-obj',
      name: 'Sala de Servidores',
      area: 25,
      height: 3.0,
      occupants: 1,
      activity: 'comercial_baixo',
      zonaId: 5,
      lightingWatts: 200,
      hasRoof: true,
      roofType: 'laje_simples',
      roofArea: 25,
      walls: [],
      windows: [],
      equipment: [
        { id: 1, name: 'Servidor Rack 1U', watts: 450, qty: 4 }
      ]
    };

    const objString = exportToOBJ(env);

    expect(typeof objString).toBe('string');
    expect(objString.length).toBeGreaterThan(300);

    // Valida elementos sintáticos do formato OBJ 3D
    expect(objString).toContain('# HVAC Thermal Load Pro 3D Model Export');
    expect(objString).toContain('o Room_Floor');
    expect(objString).toContain('o Wall_South');
    expect(objString).toContain('o Wall_North');
    expect(objString).toContain('o Wall_West');
    expect(objString).toContain('o Wall_East');
    expect(objString).toContain('v ');
    expect(objString).toContain('f ');
    expect(objString).toContain('Equipment_');
  });
});
