export type Orientation = 'norte' | 'sul' | 'leste' | 'oeste';

export type RoofType = 
  | 'laje_simples' 
  | 'laje_isolada' 
  | 'telha_fibro' 
  | 'telha_ceram_forro' 
  | 'telhado_verde';

export type WallType = 
  | 'alvenaria_leve' 
  | 'alvenaria_pesada' 
  | 'drywall_isolado';

export type GlassType = 
  | 'simples' 
  | 'duplo';

export type ActivityType = 
  | 'residencial' 
  | 'comercial_baixo' 
  | 'comercial_alto' 
  | 'cozinha';

export interface Wall {
  id: string | number;
  area: number;
  orientation: Orientation;
  type: WallType;
}

export interface Window {
  id: string | number;
  area: number;
  orientation: Orientation;
  glassType: GlassType;
  protection: number;
}

export interface Equipment {
  id: string | number;
  name: string;
  watts: number;
  qty: number;
}

export interface HVACEnvironment {
  id: string;
  name: string;
  area: number;
  height: number;
  occupants: number;
  activity: ActivityType;
  zonaId: number;
  lightingWatts: number;
  hasRoof: boolean;
  roofType: RoofType;
  roofArea: number;
  walls: Wall[];
  windows: Window[];
  equipment: Equipment[];
}

export interface ProjectInfo {
  name: string;
  client: string;
  date: string;
}

export interface ThermalBreakdown {
  infiltracao: number;
  pessoas: number;
  iluminacao: number;
  equipamentos: number;
  telhado: number;
  paredes: number;
  janelas: number;
}

export interface HVACResult {
  id: string;
  name: string;
  breakdown: ThermalBreakdown;
  total: number;
  sugerida: string;
  potenciaEstimadaKW: number;
}

export type StandardMode = 'ABNT' | 'ASHRAE_RTS' | 'ISO_52016';

export interface MaterialOption {
  id: string;
  name: string;
  uFactor: number;
  description: string;
}

export interface MaterialCatalog {
  paredes: MaterialOption[];
  telhados: MaterialOption[];
  vidros: MaterialOption[];
}

export interface HourlySolarData {
  hour: number;
  radiationDirect: number;
  radiationDiffuse: number;
  solarAltitude: number;
}

export interface HourlyLoadBreakdown {
  hour: number;
  infiltracao: number;
  pessoas: number;
  iluminacao: number;
  equipamentos: number;
  telhado: number;
  paredes: number;
  janelas: number;
  total: number;
}

export interface HVACResult24h extends HVACResult {
  standardMode: StandardMode;
  hourlyProfile: HourlyLoadBreakdown[];
  peakHour: number;
  peakTotalBTU: number;
}

