import { EquipmentOption } from '../types/hvac';
import initialEquipment from '../data/equipment.json';

const STORAGE_KEY = 'hvac_equipment_catalog';

export class EquipmentService {
  private catalog: EquipmentOption[];

  constructor() {
    this.catalog = JSON.parse(JSON.stringify(initialEquipment));
    this.loadFromStorage();
  }

  private normalizeCatalog(parsed: any): EquipmentOption[] {
    if (Array.isArray(parsed)) {
      return parsed.filter((item: any) => 
        item && 
        typeof item.id === 'string' && 
        typeof item.name === 'string' && 
        typeof item.powerWatts === 'number'
      );
    }
    return JSON.parse(JSON.stringify(initialEquipment));
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.catalog = this.normalizeCatalog(parsed);
        } catch (e) {
          console.error('Failed to parse local equipment catalog', e);
        }
      }
    }
  }

  public async getCatalog(): Promise<EquipmentOption[]> {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/equipment');
        if (res.ok) {
          const data = await res.json();
          this.catalog = this.normalizeCatalog(data);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.catalog));
            } catch (e) {
              console.error('Failed to save to localStorage', e);
            }
          }
        }
      }
    } catch (err) {
      // Fallback to local memory / localStorage state
    }
    return this.catalog;
  }

  public async saveCatalog(newCatalog: EquipmentOption[]): Promise<boolean> {
    this.catalog = newCatalog;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCatalog));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
    }
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCatalog)
        });
        return res.ok;
      }
      return true;
    } catch (err) {
      return true; // Saved locally
    }
  }

  public async addEquipment(option: EquipmentOption): Promise<EquipmentOption[]> {
    if (!option.name || !option.name.trim()) throw new Error('Nome é obrigatório');
    if (option.powerWatts <= 0) throw new Error('Potência deve ser maior que zero');
    const current = await this.getCatalog();
    const filtered = current.filter(item => item.id !== option.id);
    const updated = [...filtered, option];
    await this.saveCatalog(updated);
    return updated;
  }

  public async removeEquipment(id: string): Promise<EquipmentOption[]> {
    const current = await this.getCatalog();
    const updated = current.filter(item => item.id !== id);
    await this.saveCatalog(updated);
    return updated;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.catalog, null, 2);
  }

  public async importFromJSON(jsonString: string): Promise<EquipmentOption[]> {
    const parsed = JSON.parse(jsonString);
    if (!parsed) throw new Error('Formato JSON inválido.');
    
    const newCatalog = this.normalizeCatalog(parsed);
    await this.saveCatalog(newCatalog);
    return newCatalog;
  }

  public exportToCSV(): string {
    const rows = ['id,nome,powerWatts,heatDissipationFraction,usageProfile,descricao'];
    
    for (const item of this.catalog) {
      const cleanName = `"${(item.name || '').replace(/"/g, '""')}"`;
      const cleanProfile = `"${(item.usageProfile || '').replace(/"/g, '""')}"`;
      const cleanDesc = `"${(item.description || '').replace(/"/g, '""')}"`;
      rows.push(`${item.id},${cleanName},${item.powerWatts},${item.heatDissipationFraction},${cleanProfile},${cleanDesc}`);
    }
    return rows.join('\n');
  }

  public async importFromCSV(csvString: string): Promise<EquipmentOption[]> {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return this.catalog;

    const newCatalog: EquipmentOption[] = [...this.catalog];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match[0] === '' && matches.length > 0 && regex.lastIndex === line.length) break;
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        matches.push(val.trim());
      }

      if (matches.length >= 5) {
        const id = matches[0];
        const name = matches[1];
        const powerWatts = parseFloat(matches[2]);
        const heatDissipationFraction = parseFloat(matches[3]);
        const usageProfile = matches[4] || 'Comercial 8h';
        const description = matches[5] || '';

        if (id && name && !isNaN(powerWatts) && powerWatts > 0) {
          const item: EquipmentOption = {
            id: id || `csv_eq_${Date.now()}_${i}`,
            name,
            powerWatts,
            heatDissipationFraction: isNaN(heatDissipationFraction) ? 0.9 : heatDissipationFraction,
            usageProfile,
            description
          };
          const existingIndex = newCatalog.findIndex(e => e.id === item.id);
          if (existingIndex >= 0) {
            newCatalog[existingIndex] = item;
          } else {
            newCatalog.push(item);
          }
        }
      }
    }

    await this.saveCatalog(newCatalog);
    return newCatalog;
  }
}

export const defaultEquipmentService = new EquipmentService();
