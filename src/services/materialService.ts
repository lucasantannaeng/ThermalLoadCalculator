import { MaterialCatalog, MaterialOption } from '../types/hvac';
import initialMaterials from '../data/materials.json';

const STORAGE_KEY = 'hvac_materials_catalog';

export class MaterialService {
  private catalog: MaterialCatalog;

  constructor() {
    this.catalog = JSON.parse(JSON.stringify(initialMaterials));
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          this.catalog = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse local materials catalog', e);
        }
      }
    }
  }

  public async getCatalog(): Promise<MaterialCatalog> {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          this.catalog = data;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          }
        }
      }
    } catch (err) {
      // Fallback to local memory / localStorage state
    }
    return this.catalog;
  }

  public async saveCatalog(newCatalog: MaterialCatalog): Promise<boolean> {
    this.catalog = newCatalog;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCatalog));
    }
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/materials', {
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

  public async addMaterial(category: keyof MaterialCatalog, option: MaterialOption): Promise<MaterialCatalog> {
    const current = await this.getCatalog();
    const list = current[category] || [];
    current[category] = [...list.filter((m: MaterialOption) => m.id !== option.id), option];
    await this.saveCatalog(current);
    return current;
  }

  public async removeMaterial(category: keyof MaterialCatalog, id: string): Promise<MaterialCatalog> {
    const current = await this.getCatalog();
    const list = current[category] || [];
    current[category] = list.filter((m: MaterialOption) => m.id !== id);
    await this.saveCatalog(current);
    return current;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.catalog, null, 2);
  }

  public async importFromJSON(jsonString: string): Promise<MaterialCatalog> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') throw new Error('Formato JSON inválido.');
    
    const newCatalog: MaterialCatalog = {
      paredes: Array.isArray(parsed.paredes) ? parsed.paredes : this.catalog.paredes,
      telhados: Array.isArray(parsed.telhados) ? parsed.telhados : this.catalog.telhados,
      vidros: Array.isArray(parsed.vidros) ? parsed.vidros : this.catalog.vidros,
    };
    
    await this.saveCatalog(newCatalog);
    return newCatalog;
  }

  public exportToCSV(): string {
    const rows = ['categoria,id,nome,uFactor,descricao'];
    
    const categories: (keyof MaterialCatalog)[] = ['paredes', 'telhados', 'vidros'];
    for (const cat of categories) {
      for (const item of this.catalog[cat]) {
        const cleanName = `"${(item.name || '').replace(/"/g, '""')}"`;
        const cleanDesc = `"${(item.description || '').replace(/"/g, '""')}"`;
        rows.push(`${cat},${item.id},${cleanName},${item.uFactor},${cleanDesc}`);
      }
    }
    return rows.join('\n');
  }

  public async importFromCSV(csvString: string): Promise<MaterialCatalog> {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return this.catalog;

    const newCatalog: MaterialCatalog = JSON.parse(JSON.stringify(this.catalog));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex parsing for CSV fields considering quotes
      const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match[0] === '' && matches.length > 0 && regex.lastIndex === line.length) break;
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        matches.push(val.trim());
      }

      if (matches.length >= 4) {
        const cat = matches[0] as keyof MaterialCatalog;
        const id = matches[1];
        const name = matches[2];
        const uFactor = parseFloat(matches[3]);
        const description = matches[4] || '';

        if (['paredes', 'telhados', 'vidros'].includes(cat) && !isNaN(uFactor) && uFactor > 0 && name) {
          const item: MaterialOption = { id: id || `csv_${Date.now()}_${i}`, name, uFactor, description };
          newCatalog[cat] = [...newCatalog[cat].filter(m => m.id !== item.id), item];
        }
      }
    }

    await this.saveCatalog(newCatalog);
    return newCatalog;
  }
}

export const defaultMaterialService = new MaterialService();

