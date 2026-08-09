import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MaterialService, defaultMaterialService } from '../services/materialService';
import { MaterialCatalog, MaterialOption } from '../types/hvac';
import initialMaterials from '../data/materials.json';

describe('MaterialService - Persistência Local & Fallback', () => {
  let service: MaterialService;
  
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
    service = new MaterialService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve carregar o catálogo de materiais inicial via fallback', async () => {
    const catalog = await service.getCatalog();
    expect(catalog.paredes.length).toBeGreaterThan(0);
    expect(catalog.telhados.length).toBeGreaterThan(0);
    expect(catalog.vidros.length).toBeGreaterThan(0);
    expect(catalog.paredes.some(m => m.id === 'alvenaria_leve')).toBe(true);
  });

  it('deve buscar o catálogo via /api/materials quando a API responder com sucesso', async () => {
    const mockData: MaterialCatalog = {
      paredes: [{ id: 'custom_wall', name: 'Parede Custom', uFactor: 1.0, description: 'Desc' }],
      telhados: [{ id: 'custom_roof', name: 'Telhado Custom', uFactor: 0.5, description: 'Desc' }],
      vidros: [{ id: 'custom_glass', name: 'Vidro Custom', uFactor: 2.0, description: 'Desc' }]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    } as Response);

    const catalog = await service.getCatalog();
    expect(catalog).toEqual(mockData);
    expect(localStorage.getItem('hvac_materials_catalog')).toBe(JSON.stringify(mockData));
  });

  it('deve salvar o catálogo via POST /api/materials e atualizar localStorage', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      return { ok: true, json: async () => initialMaterials } as Response;
    });
    globalThis.fetch = fetchMock;

    const current = await service.getCatalog();
    const updated: MaterialCatalog = {
      ...current,
      paredes: [
        ...current.paredes,
        { id: 'parede_nova', name: 'Parede Nova', uFactor: 1.2, description: 'Parede Nova Teste' }
      ]
    };

    const savedSuccess = await service.saveCatalog(updated);
    expect(savedSuccess).toBe(true);
    expect(localStorage.getItem('hvac_materials_catalog')).toBe(JSON.stringify(updated));
    expect(fetchMock).toHaveBeenCalledWith('/api/materials', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }));
  });

  it('deve adicionar um novo material na categoria com addMaterial', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

    const initialCatalog = await service.getCatalog();
    const initialWallCount = initialCatalog.paredes.length;

    const newWall = {
      id: 'parede_eps_100',
      name: 'Painel EPS 100mm',
      uFactor: 0.35,
      description: 'Painel sanduíche isolante EPS'
    };

    const updatedCatalog = await service.addMaterial('paredes', newWall);

    expect(updatedCatalog.paredes.length).toBe(initialWallCount + 1);
    expect(updatedCatalog.paredes.find((m: MaterialOption) => m.id === 'parede_eps_100')).toEqual(newWall);
  });

  it('deve remover um material existente da categoria com removeMaterial', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));

    const initialCatalog = await service.getCatalog();
    const wallToRemove = initialCatalog.paredes[0];
    const initialWallCount = initialCatalog.paredes.length;

    const updatedCatalog = await service.removeMaterial('paredes', wallToRemove.id);

    expect(updatedCatalog.paredes.length).toBe(initialWallCount - 1);
    expect(updatedCatalog.paredes.find((m: MaterialOption) => m.id === wallToRemove.id)).toBeUndefined();
  });

  it('deve exportar e importar o catálogo em formato JSON', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
    const jsonStr = service.exportToJSON();
    expect(jsonStr).toContain('paredes');

    const importedCatalog = await service.importFromJSON(jsonStr);
    expect(importedCatalog.paredes.length).toBeGreaterThan(0);
  });

  it('deve exportar e importar o catálogo em formato CSV', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('API Offline'));
    const csvStr = service.exportToCSV();
    expect(csvStr).toContain('categoria,id,nome,uFactor,descricao');
    expect(csvStr).toContain('paredes');

    const testCSV = `categoria,id,nome,uFactor,descricao\nparedes,parede_csv_1,"Parede Bloco Maciço",1.85,"Alvenaria com EPS"`;
    const importedCatalog = await service.importFromCSV(testCSV);
    expect(importedCatalog.paredes.some(m => m.id === 'parede_csv_1')).toBe(true);
  });

  it('deve exportar a instância singleton defaultMaterialService', () => {
    expect(defaultMaterialService).toBeInstanceOf(MaterialService);
  });
});

