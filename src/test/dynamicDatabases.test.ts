import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ActivityService, defaultActivityService } from '../services/activityService';
import { EquipmentService, defaultEquipmentService } from '../services/equipmentService';
import { ActivityOption, EquipmentOption } from '../types/hvac';
import initialActivities from '../data/activities.json';
import initialEquipment from '../data/equipment.json';

describe('Dynamic Databases & Services (Activities & Equipment)', () => {

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value.toString(); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    };
  })();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ActivityService - Atividades Operacionais', () => {
    let service: ActivityService;

    beforeEach(() => {
      service = new ActivityService();
    });

    it('deve carregar o banco de atividades inicial via fallback', async () => {
      const catalog = await service.getCatalog();
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.some((a: ActivityOption) => a.id === 'escritorio_trabalho_leve')).toBe(true);
      expect(catalog.some((a: ActivityOption) => a.id === 'academia_exercicio_intenso')).toBe(true);
    });

    it('deve buscar o catálogo via /api/activities quando a API responder com sucesso', async () => {
      const mockData: ActivityOption[] = [
        {
          id: 'test_act',
          name: 'Atividade Teste',
          metabolicRateW: 200,
          sensibleFraction: 0.6,
          latentFraction: 0.4,
          wattsPerSqMeter: 20,
          description: 'Teste'
        }
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as Response);

      const catalog = await service.getCatalog();
      expect(catalog).toEqual(mockData);
      expect(localStorage.getItem('hvac_activities_catalog')).toBe(JSON.stringify(mockData));
    });

    it('deve salvar o catálogo via POST /api/activities e atualizar localStorage', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true }) } as Response;
        }
        return { ok: true, json: async () => initialActivities } as Response;
      });
      globalThis.fetch = fetchMock;

      const current = await service.getCatalog();
      const updated: ActivityOption[] = [
        ...current,
        {
          id: 'act_nova',
          name: 'Atividade Nova',
          metabolicRateW: 130,
          sensibleFraction: 0.7,
          latentFraction: 0.3,
          wattsPerSqMeter: 18,
          description: 'Nova atividade criada'
        }
      ];

      const savedSuccess = await service.saveCatalog(updated);
      expect(savedSuccess).toBe(true);
      expect(localStorage.getItem('hvac_activities_catalog')).toBe(JSON.stringify(updated));
      expect(fetchMock).toHaveBeenCalledWith('/api/activities', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }));
    });

    it('deve adicionar uma nova atividade com addActivity', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

      const initialList = await service.getCatalog();
      const countBefore = initialList.length;

      const newAct: ActivityOption = {
        id: 'act_crossfit',
        name: 'Crossfit de Alta Performance',
        metabolicRateW: 500,
        sensibleFraction: 0.35,
        latentFraction: 0.65,
        wattsPerSqMeter: 60,
        description: 'Treinamento funcional extremo'
      };

      const updatedList = await service.addActivity(newAct);
      expect(updatedList.length).toBe(countBefore + 1);
      expect(updatedList.find(a => a.id === 'act_crossfit')).toEqual(newAct);
    });

    it('deve remover uma atividade existente com removeActivity', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

      const initialList = await service.getCatalog();
      const itemToRemove = initialList[0];
      const countBefore = initialList.length;

      const updatedList = await service.removeActivity(itemToRemove.id);
      expect(updatedList.length).toBe(countBefore - 1);
      expect(updatedList.find(a => a.id === itemToRemove.id)).toBeUndefined();
    });

    it('deve exportar e importar o banco de atividades em formato JSON', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
      const jsonStr = service.exportToJSON();
      expect(jsonStr).toContain('escritorio_trabalho_leve');

      const imported = await service.importFromJSON(jsonStr);
      expect(imported.length).toBeGreaterThan(0);
      expect(imported.some(a => a.id === 'escritorio_trabalho_leve')).toBe(true);
    });

    it('deve exportar e importar o banco de atividades em formato CSV', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
      const csvStr = service.exportToCSV();
      expect(csvStr).toContain('id,nome,metabolicRateW,sensibleFraction,latentFraction,wattsPerSqMeter,descricao');
      expect(csvStr).toContain('escritorio_trabalho_leve');

      const testCSV = `id,nome,metabolicRateW,sensibleFraction,latentFraction,wattsPerSqMeter,descricao\nact_csv_1,"Dança / Zamba",300,0.5,0.5,40,"Dança em estúdio"`;
      const imported = await service.importFromCSV(testCSV);
      expect(imported.some((a: ActivityOption) => a.id === 'act_csv_1')).toBe(true);
    });

    it('deve exportar a instância singleton defaultActivityService', () => {
      expect(defaultActivityService).toBeInstanceOf(ActivityService);
    });
  });

  describe('EquipmentService - Equipamentos Elétricos', () => {
    let service: EquipmentService;

    beforeEach(() => {
      service = new EquipmentService();
    });

    it('deve carregar o banco de equipamentos inicial via fallback', async () => {
      const catalog = await service.getCatalog();
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.some(e => e.id === 'desktop_pc')).toBe(true);
      expect(catalog.some(e => e.id === 'servidor_rack')).toBe(true);
    });

    it('deve buscar o catálogo via /api/equipment quando a API responder com sucesso', async () => {
      const mockData: EquipmentOption[] = [
        {
          id: 'test_eq',
          name: 'Equipamento Teste',
          powerWatts: 1000,
          heatDissipationFraction: 0.95,
          usageProfile: 'Continuo 24h',
          description: 'Teste de equipamento'
        }
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as Response);

      const catalog = await service.getCatalog();
      expect(catalog).toEqual(mockData);
      expect(localStorage.getItem('hvac_equipment_catalog')).toBe(JSON.stringify(mockData));
    });

    it('deve salvar o catálogo via POST /api/equipment e atualizar localStorage', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true }) } as Response;
        }
        return { ok: true, json: async () => initialEquipment } as Response;
      });
      globalThis.fetch = fetchMock;

      const current = await service.getCatalog();
      const updated: EquipmentOption[] = [
        ...current,
        {
          id: 'eq_novo',
          name: 'Equipamento Novo',
          powerWatts: 600,
          heatDissipationFraction: 0.85,
          usageProfile: 'Comercial 8h',
          description: 'Novo equipamento cadastrado'
        }
      ];

      const savedSuccess = await service.saveCatalog(updated);
      expect(savedSuccess).toBe(true);
      expect(localStorage.getItem('hvac_equipment_catalog')).toBe(JSON.stringify(updated));
      expect(fetchMock).toHaveBeenCalledWith('/api/equipment', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }));
    });

    it('deve adicionar um novo equipamento com addEquipment', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

      const initialList = await service.getCatalog();
      const countBefore = initialList.length;

      const newEq: EquipmentOption = {
        id: 'eq_nvr',
        name: 'Gravador NVR 32 Canais',
        powerWatts: 120,
        heatDissipationFraction: 0.95,
        usageProfile: 'Continuo 24h',
        description: 'Gravador de vídeo segurança'
      };

      const updatedList = await service.addEquipment(newEq);
      expect(updatedList.length).toBe(countBefore + 1);
      expect(updatedList.find(e => e.id === 'eq_nvr')).toEqual(newEq);
    });

    it('deve remover um equipamento existente com removeEquipment', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

      const initialList = await service.getCatalog();
      const itemToRemove = initialList[0];
      const countBefore = initialList.length;

      const updatedList = await service.removeEquipment(itemToRemove.id);
      expect(updatedList.length).toBe(countBefore - 1);
      expect(updatedList.find(e => e.id === itemToRemove.id)).toBeUndefined();
    });

    it('deve exportar e importar o banco de equipamentos em formato JSON', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
      const jsonStr = service.exportToJSON();
      expect(jsonStr).toContain('desktop_pc');

      const imported = await service.importFromJSON(jsonStr);
      expect(imported.length).toBeGreaterThan(0);
      expect(imported.some(e => e.id === 'desktop_pc')).toBe(true);
    });

    it('deve exportar e importar o banco de equipamentos em formato CSV', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
      const csvStr = service.exportToCSV();
      expect(csvStr).toContain('id,nome,powerWatts,heatDissipationFraction,usageProfile,descricao');
      expect(csvStr).toContain('desktop_pc');

      const testCSV = `id,nome,powerWatts,heatDissipationFraction,usageProfile,descricao\neq_csv_1,"Plotter HP DesignJet",400,0.85,"Intermitente","Plotter para desenhos técnicos"`;
      const imported = await service.importFromCSV(testCSV);
      expect(imported.some(e => e.id === 'eq_csv_1')).toBe(true);
    });

    it('deve exportar a instância singleton defaultEquipmentService', () => {
      expect(defaultEquipmentService).toBeInstanceOf(EquipmentService);
    });
  });
});
