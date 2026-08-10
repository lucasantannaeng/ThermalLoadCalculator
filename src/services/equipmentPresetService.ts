import { EquipmentPresetOption } from '../types/hvac';

const STORAGE_KEY = 'hvac_equipment_preset_catalog';

export const INITIAL_EQUIPMENT_PRESETS: EquipmentPresetOption[] = Object.freeze([
  { id: 'desktop_monitor', name: 'Computador Desktop + Monitor', watts: 300, category: 'TI / Informática', description: 'Workstation padrão com monitor LCD/LED 24".' },
  { id: 'notebook_prof', name: 'Notebook Profissional', watts: 75, category: 'TI / Informática', description: 'Laptop corporativo com fonte ultra-eficiente.' },
  { id: 'servidor_1u', name: 'Servidor Rack Small (1U)', watts: 450, category: 'Data Center / TI', description: 'Servidor de aplicação compacto para rack 19".' },
  { id: 'tv_led_55', name: 'Televisor LED 55-65"', watts: 160, category: 'Multimídia / Vídeo', description: 'Tela de exibição corporativa em sala de reunião.' },
  { id: 'console_game', name: 'Console de Video Game', watts: 200, category: 'Multimídia / Entretenimento', description: 'Console de jogos para área de descompressão.' },
  { id: 'impressora_laser', name: 'Impressora Laser Multifuncional', watts: 400, category: 'Escritório', description: 'Impressora comercial com pico de fusor térmico.' },
  { id: 'frigobar', name: 'Refrigerador Comercial / Frigobar', watts: 180, category: 'Eletrodomésticos', description: 'Frigobar de apoio ou geladeira de copa.' },
  { id: 'cafeteira_ind', name: 'Cafeteira Elétrica Industrial', watts: 800, category: 'Copa / Cozinha', description: 'Cafeteira de alta potência com aquecimento contínuo.' },
  { id: 'projetor_lumen', name: 'Projetor Multimídia High Lumen', watts: 350, category: 'Multimídia / Vídeo', description: 'Projetor de alta luminosidade para auditórios.' },
  { id: 'render_workstation', name: 'Workstation Rendering GPU (Multi-GPU)', watts: 850, category: 'TI / Informática', description: 'Estação de trabalho pesada para modelagem e render CAD 3D.' },
  { id: 'iluminacao_palco', name: 'Iluminação de Palco / Estúdio LED', watts: 600, category: 'Iluminação Especial', description: 'Refletores de estúdio ou palco.' }
]) as EquipmentPresetOption[];

export class EquipmentPresetService {
  private presets: EquipmentPresetOption[];

  constructor() {
    this.presets = JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_PRESETS));
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.presets = parsed;
          }
        } catch (e) {
          console.error('Failed to parse equipment preset catalog', e);
        }
      }
    }
  }

  public async getPresets(): Promise<EquipmentPresetOption[]> {
    return [...this.presets];
  }

  public async savePresets(list: EquipmentPresetOption[]): Promise<boolean> {
    this.presets = list;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
    }
    return true;
  }

  public async addPreset(option: EquipmentPresetOption): Promise<EquipmentPresetOption[]> {
    if (!option.name || !option.name.trim()) throw new Error('Nome é obrigatório');
    if (option.watts <= 0) throw new Error('Potência deve ser maior que zero');
    const current = await this.getPresets();
    const updated = [...current.filter(e => e.id !== option.id), option];
    await this.savePresets(updated);
    return updated;
  }

  public async removePreset(id: string): Promise<EquipmentPresetOption[]> {
    const current = await this.getPresets();
    const updated = current.filter(e => e.id !== id);
    await this.savePresets(updated);
    return updated;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.presets, null, 2);
  }

  public async importFromJSON(jsonString: string): Promise<EquipmentPresetOption[]> {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) throw new Error('Formato JSON de equipamentos inválido.');
    await this.savePresets(parsed);
    return this.presets;
  }

  public exportToCSV(): string {
    const rows = ['id,nome,potenciaWatts,categoria,descricao'];
    for (const item of this.presets) {
      const cleanName = `"${(item.name || '').replace(/"/g, '""')}"`;
      const cleanCat = `"${(item.category || '').replace(/"/g, '""')}"`;
      const cleanDesc = `"${(item.description || '').replace(/"/g, '""')}"`;
      rows.push(`${item.id},${cleanName},${item.watts},${cleanCat},${cleanDesc}`);
    }
    return rows.join('\n');
  }
}

export const defaultEquipmentPresetService = new EquipmentPresetService();
