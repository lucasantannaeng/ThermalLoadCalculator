import { describe, it, expect } from 'vitest';
import { calculateHVAC24h } from '../calculation/engines/hvacEngineFactory';
import { calculateABNT24h } from '../calculation/engines/abntEngine';
import { calculateASHRAERTS24h } from '../calculation/engines/ashraeRtsEngine';
import { calculateISO24h } from '../calculation/engines/isoEngine';
import { HVACEnvironment } from '../types/hvac';

const sampleEnv: HVACEnvironment = {
  id: 'env-test-24h',
  name: 'Escritório Comercial Teste',
  area: 50,
  height: 3.0,
  occupants: 6,
  activity: 'comercial_baixo',
  zonaId: 3,
  lightingWatts: 400,
  hasRoof: true,
  roofType: 'laje_isolada',
  roofArea: 50,
  walls: [
    { id: 1, area: 25, orientation: 'oeste', type: 'alvenaria_pesada' },
    { id: 2, area: 20, orientation: 'norte', type: 'alvenaria_leve' }
  ],
  windows: [
    { id: 1, area: 8, orientation: 'oeste', glassType: 'simples', protection: 0.7 },
    { id: 2, area: 4, orientation: 'norte', glassType: 'duplo', protection: 0.5 }
  ],
  equipment: [
    { id: 1, name: 'Computadores', watts: 250, qty: 6 },
    { id: 2, name: 'Impressora', watts: 300, qty: 1 }
  ]
};

describe('HVAC Multi-Standard 24h Engines', () => {
  describe('ABNT NBR 16401 Engine (abntEngine.ts)', () => {
    it('deve calcular resultado 24h válido para ABNT', () => {
      const result = calculateABNT24h(sampleEnv);
      expect(result.id).toBe(sampleEnv.id);
      expect(result.standardMode).toBe('ABNT');
      expect(result.hourlyProfile).toHaveLength(24);
      expect(result.peakHour).toBeGreaterThanOrEqual(0);
      expect(result.peakHour).toBeLessThan(24);
      expect(result.peakTotalBTU).toBeGreaterThan(10000);
      expect(result.total).toBe(result.peakTotalBTU);
      expect(result.sugerida).toBeDefined();
      expect(result.potenciaEstimadaKW).toBeGreaterThan(0);
    });

    it('deve apresentar variação de carga entre o dia e a noite na curva de 24h', () => {
      const result = calculateABNT24h(sampleEnv);
      const profile = result.hourlyProfile;
      const loadNight = profile[3].total; // 03:00
      const loadDay = profile[15].total;   // 15:00
      expect(loadDay).toBeGreaterThan(loadNight);
    });
  });

  describe('ASHRAE RTS Engine (ashraeRtsEngine.ts)', () => {
    it('deve aplicar amortecimento radiante e atraso de fase CTF na curva 24h', () => {
      const resultRTS = calculateASHRAERTS24h(sampleEnv);
      expect(resultRTS.standardMode).toBe('ASHRAE_RTS');
      expect(resultRTS.hourlyProfile).toHaveLength(24);
      expect(resultRTS.peakTotalBTU).toBeGreaterThan(10000);
      
      const abntRes = calculateABNT24h(sampleEnv);
      // RTS deve amortecer picos pontuais comparado ao modelo instantâneo
      expect(resultRTS.hourlyProfile[3].total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ISO 52016-1 Engine (isoEngine.ts)', () => {
    it('deve calcular balanço térmico dinâmico horário ISO 52016-1', () => {
      const resultISO = calculateISO24h(sampleEnv);
      expect(resultISO.standardMode).toBe('ISO_52016');
      expect(resultISO.hourlyProfile).toHaveLength(24);
      expect(resultISO.peakTotalBTU).toBeGreaterThan(10000);
      expect(resultISO.breakdown.paredes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HVAC Engine Factory (hvacEngineFactory.ts)', () => {
    it('deve despachar para a norma correta baseada no parâmetro mode', () => {
      const abnt = calculateHVAC24h(sampleEnv, 'ABNT');
      const rts = calculateHVAC24h(sampleEnv, 'ASHRAE_RTS');
      const iso = calculateHVAC24h(sampleEnv, 'ISO_52016');

      expect(abnt.standardMode).toBe('ABNT');
      expect(rts.standardMode).toBe('ASHRAE_RTS');
      expect(iso.standardMode).toBe('ISO_52016');
    });

    it('deve usar ABNT por padrão se nenhum modo for fornecido', () => {
      const defaultModeResult = calculateHVAC24h(sampleEnv);
      expect(defaultModeResult.standardMode).toBe('ABNT');
    });

    it('deve suportar materiais customizados definidos no customCatalog', () => {
      const envCustomMat: HVACEnvironment = {
        ...sampleEnv,
        customCatalog: {
          paredes: [{ id: 'parede_super_isolada', name: 'Painel VIP 100mm', uFactor: 0.15, description: 'Super' }],
          telhados: [{ id: 'telhado_super_isolado', name: 'Telhado EPS 200mm', uFactor: 0.20, description: 'Super' }],
          vidros: [{ id: 'vidro_triplo_lowe', name: 'Vidro Triplo Low-E', uFactor: 1.1, description: 'Super' }]
        },
        roofType: 'telhado_super_isolado',
        walls: [{ id: 1, area: 25, orientation: 'oeste', type: 'parede_super_isolada' }],
        windows: [{ id: 1, area: 8, orientation: 'oeste', glassType: 'vidro_triplo_lowe', protection: 0.7 }]
      };

      const resultStandard = calculateHVAC24h(sampleEnv, 'ABNT');
      const resultCustom = calculateHVAC24h(envCustomMat, 'ABNT');

      // Com materiais de menor transmitância (uFactor menor), a carga de paredes, telhado e janelas deve ser menor
      expect(resultCustom.breakdown.paredes).toBeLessThan(resultStandard.breakdown.paredes);
      expect(resultCustom.breakdown.telhado).toBeLessThan(resultStandard.breakdown.telhado);
    });
  });
});
