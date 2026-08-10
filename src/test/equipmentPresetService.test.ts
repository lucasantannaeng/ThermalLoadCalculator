import { describe, it, expect, beforeEach } from 'vitest';
import { defaultEquipmentPresetService, INITIAL_EQUIPMENT_PRESETS } from '../services/equipmentPresetService';

describe('EquipmentPresetService - Catálogo de Equipamentos Elétricos', () => {
  beforeEach(async () => {
    await defaultEquipmentPresetService.savePresets(JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_PRESETS)));
  });

  it('deve carregar o catálogo inicial de equipamentos', async () => {
    const list = await defaultEquipmentPresetService.getPresets();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some(e => e.name.includes('Desktop'))).toBe(true);
  });

  it('deve adicionar um novo equipamento personalizado', async () => {
    const before = await defaultEquipmentPresetService.getPresets();
    await defaultEquipmentPresetService.addPreset({
      id: 'custom_laser_cutter',
      name: 'Cortadora a Laser CO2 100W',
      watts: 1500,
      category: 'Oficina / Prototipagem',
      description: 'Equipamento de corte e gravação a laser.'
    });

    const updated = await defaultEquipmentPresetService.getPresets();
    expect(updated.length).toBe(before.length + 1);
    expect(updated.find(e => e.id === 'custom_laser_cutter')?.watts).toBe(1500);
  });

  it('deve remover um equipamento do catálogo', async () => {
    await defaultEquipmentPresetService.removePreset('console_game');
    const updated = await defaultEquipmentPresetService.getPresets();
    expect(updated.some(e => e.id === 'console_game')).toBe(false);
  });

  it('deve exportar catálogo em formato JSON válido', () => {
    const jsonStr = defaultEquipmentPresetService.exportToJSON();
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
