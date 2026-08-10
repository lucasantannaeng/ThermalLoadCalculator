import { ActivityOption } from '../types/hvac';
import initialActivities from '../data/activities.json';

const STORAGE_KEY = 'hvac_activities_catalog';

export const INITIAL_ACTIVITIES: ActivityOption[] = Object.freeze(initialActivities as any) as ActivityOption[];

export class ActivityService {
  private catalog: ActivityOption[];

  constructor() {
    this.catalog = this.normalizeCatalog(initialActivities);
    this.loadFromStorage();
  }

  private normalizeCatalog(parsed: any): ActivityOption[] {
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => {
        const metabolicRateW = typeof item.metabolicRateW === 'number' 
          ? item.metabolicRateW 
          : (typeof item.heatPerPersonWatts === 'number' ? item.heatPerPersonWatts : 115);

        const sensibleFraction = typeof item.sensibleFraction === 'number'
          ? item.sensibleFraction
          : (typeof item.sensibleRatio === 'number' ? item.sensibleRatio : 0.65);

        const latentFraction = typeof item.latentFraction === 'number'
          ? item.latentFraction
          : parseFloat((1 - sensibleFraction).toFixed(2));

        const wattsPerSqMeter = typeof item.wattsPerSqMeter === 'number'
          ? item.wattsPerSqMeter
          : 15.0;

        return {
          id: String(item.id || `act_${Date.now()}`),
          name: String(item.name || 'Atividade Indefinida'),
          metabolicRateW,
          sensibleFraction,
          latentFraction,
          wattsPerSqMeter,
          description: String(item.description || '')
        };
      });
    }
    return JSON.parse(JSON.stringify(initialActivities));
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.catalog = this.normalizeCatalog(parsed);
        } catch (e) {
          console.error('Failed to parse local activities catalog', e);
        }
      }
    }
  }

  public async getCatalog(): Promise<ActivityOption[]> {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const data = await res.json();
          this.catalog = this.normalizeCatalog(data);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.catalog));
            } catch (e) {
              console.error('Failed to save activities to localStorage', e);
            }
          }
        }
      }
    } catch (err) {
      // Fallback to local memory / localStorage state
    }
    return this.catalog;
  }

  // Alias for backward compatibility if code calls getActivities
  public async getActivities(): Promise<ActivityOption[]> {
    return this.getCatalog();
  }

  public async saveCatalog(newCatalog: ActivityOption[]): Promise<boolean> {
    this.catalog = newCatalog;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCatalog));
      } catch (e) {
        console.error('Failed to save activities to localStorage', e);
      }
    }
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/activities', {
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

  public async saveActivities(list: ActivityOption[]): Promise<boolean> {
    return this.saveCatalog(list);
  }

  public async addActivity(option: ActivityOption): Promise<ActivityOption[]> {
    if (!option.name || !option.name.trim()) throw new Error('Nome é obrigatório');
    if ((option.metabolicRateW || 0) <= 0) throw new Error('Taxa metabólica deve ser maior que zero');
    const current = await this.getCatalog();
    const filtered = current.filter(item => item.id !== option.id);
    const updated = [...filtered, option];
    await this.saveCatalog(updated);
    return updated;
  }

  public async removeActivity(id: string): Promise<ActivityOption[]> {
    const current = await this.getCatalog();
    const updated = current.filter(item => item.id !== id);
    await this.saveCatalog(updated);
    return updated;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.catalog, null, 2);
  }

  public async importFromJSON(jsonString: string): Promise<ActivityOption[]> {
    const parsed = JSON.parse(jsonString);
    if (!parsed) throw new Error('Formato JSON inválido.');
    
    const newCatalog = this.normalizeCatalog(parsed);
    await this.saveCatalog(newCatalog);
    return newCatalog;
  }

  public exportToCSV(): string {
    const rows = ['id,nome,metabolicRateW,sensibleFraction,latentFraction,wattsPerSqMeter,descricao'];
    
    for (const item of this.catalog) {
      const cleanName = `"${(item.name || '').replace(/"/g, '""')}"`;
      const cleanDesc = `"${(item.description || '').replace(/"/g, '""')}"`;
      rows.push(`${item.id},${cleanName},${item.metabolicRateW},${item.sensibleFraction},${item.latentFraction},${item.wattsPerSqMeter},${cleanDesc}`);
    }
    return rows.join('\n');
  }

  public async importFromCSV(csvString: string): Promise<ActivityOption[]> {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return this.catalog;

    const newCatalog: ActivityOption[] = [...this.catalog];

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

      if (matches.length >= 4) {
        const id = matches[0];
        const name = matches[1];
        const metabolicRateW = parseFloat(matches[2]);
        const sensibleFraction = parseFloat(matches[3]);
        const latentFraction = parseFloat(matches[4]);
        const wattsPerSqMeter = parseFloat(matches[5]);
        const description = matches[6] || matches[4] || '';

        if (id && name && !isNaN(metabolicRateW) && metabolicRateW > 0) {
          const item: ActivityOption = {
            id: id || `csv_act_${Date.now()}_${i}`,
            name,
            metabolicRateW,
            sensibleFraction: isNaN(sensibleFraction) ? 0.65 : sensibleFraction,
            latentFraction: isNaN(latentFraction) ? 0.35 : latentFraction,
            wattsPerSqMeter: isNaN(wattsPerSqMeter) ? 15.0 : wattsPerSqMeter,
            description
          };
          const existingIndex = newCatalog.findIndex(a => a.id === item.id);
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

export const defaultActivityService = new ActivityService();
