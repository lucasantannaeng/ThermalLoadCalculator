import { describe, it, expect } from 'vitest';
import { calculateEnvironmentThermalLoad } from '../utils/hvacCalculations';
import { HVACEnvironment } from '../types/hvac';
import { EXTENDED_ZONAS_BIOCLIMATICAS, PAREDE_MATERIAIS, TELHADO_MATERIAIS } from '../data/hvacPresets';

describe('HVAC Thermal Load Calculator Industrial - Testes Normativos ABNT NBR 16401 & 15220', () => {
  it('deve validar o catálogo extenso de Zonas Bioclimáticas brasileiras (Zonas 1 a 8)', () => {
    expect(EXTENDED_ZONAS_BIOCLIMATICAS.length).toBe(8);
    const spZone = EXTENDED_ZONAS_BIOCLIMATICAS.find(z => z.cidades.some(c => c.includes('São Paulo')));
    expect(spZone).toBeDefined();
    expect(spZone?.deltaT).toBe(9);
  });

  it('deve calcular a carga térmica de um ambiente corporativo com materiais customizados', () => {
    const env: HVACEnvironment = {
      id: 'env-corp-1',
      name: 'Sala de Servidores & Reunião',
      area: 30,
      height: 3.0,
      occupants: 6,
      activity: 'comercial_baixo',
      zonaId: 5, // Cuiabá (deltaT = 12)
      lightingWatts: 300,
      hasRoof: true,
      roofType: 'laje_simples',
      roofArea: 30,
      walls: [
        { id: 1, area: 15, orientation: 'oeste', type: 'alvenaria_pesada' }
      ],
      windows: [
        { id: 1, area: 3, orientation: 'oeste', glassType: 'duplo', protection: 0.6 }
      ],
      equipment: [
        { id: 1, name: 'Servidor Rack 1U', watts: 450, qty: 2 }
      ]
    };

    const result = calculateEnvironmentThermalLoad(env);

    expect(result.total).toBeGreaterThan(15000);
    expect(result.breakdown.equipamentos).toBeGreaterThan(0);
    expect(result.sugerida).toMatch(/BTU\/h/);
    expect(result.potenciaEstimadaKW).toBeGreaterThan(0);
  });
});
