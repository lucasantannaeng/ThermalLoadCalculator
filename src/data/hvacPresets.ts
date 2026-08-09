import { WallType, RoofType, GlassType, ActivityType, Orientation } from '../types/hvac';

export interface MaterialOption {
  id: string;
  name: string;
  uFactor: number; // W/(m²·K)
  description: string;
}

export interface BioclimaticZoneData {
  id: number;
  nome: string;
  cidades: string[];
  deltaT: number; // °C
  umidadeRelativaMedia: number; // %
}

export const EXTENDED_ZONAS_BIOCLIMATICAS: BioclimaticZoneData[] = [
  { id: 1, nome: "Zona 1 (Frio / Sul)", cidades: ["Curitiba/PR", "Caxias do Sul/RS", "Lages/SC", "Ponta Grossa/PR"], deltaT: 8, umidadeRelativaMedia: 78 },
  { id: 2, nome: "Zona 2 (Subtropical Ameno)", cidades: ["Rio de Janeiro/RJ", "Florianópolis/SC", "Porto Alegre/RS", "Santos/SP"], deltaT: 10, umidadeRelativaMedia: 75 },
  { id: 3, nome: "Zona 3 (Planalto Central Ameno)", cidades: ["São Paulo/SP", "Belo Horizonte/MG", "Campinas/SP", "Juiz de Fora/MG"], deltaT: 9, umidadeRelativaMedia: 70 },
  { id: 4, nome: "Zona 4 (Cerrado / Planalto)", cidades: ["Brasília/DF", "Goiânia/GO", "Montes Claros/MG", "Anápolis/GO"], deltaT: 10, umidadeRelativaMedia: 60 },
  { id: 5, nome: "Zona 5 (Quente e Seco / Centro-Oeste)", cidades: ["Cuiabá/MT", "Campo Grande/MS", "Corumbá/MS", "Rondonópolis/MT"], deltaT: 12, umidadeRelativaMedia: 55 },
  { id: 6, nome: "Zona 6 (Nordeste Semiárido)", cidades: ["Salvador/BA", "Feira de Santana/BA", "Petrolina/PE", "Juazeiro do Norte/CE"], deltaT: 9, umidadeRelativaMedia: 65 },
  { id: 7, nome: "Zona 7 (Norte/Nordeste Quente)", cidades: ["Teresina/PI", "Fortaleza/CE", "Natal/RN", "João Pessoa/PB", "Maceió/AL"], deltaT: 12, umidadeRelativaMedia: 70 },
  { id: 8, nome: "Zona 8 (Equatorial Úmido)", cidades: ["Manaus/AM", "Belém/PA", "São Luís/MA", "Macapá/AP", "Porto Velho/RO", "Rio Branco/AC"], deltaT: 11, umidadeRelativaMedia: 85 },
];

export const PAREDE_MATERIAIS: Record<WallType, MaterialOption> = {
  alvenaria_leve: { id: "alvenaria_leve", name: "Alvenaria Tijolo Baiano (6 furos - 10cm)", uFactor: 2.9, description: "Tijolo cerâmico furado sem isolamento adicional" },
  alvenaria_pesada: { id: "alvenaria_pesada", name: "Alvenaria Tijolo Maciço / Bloco Concreto (20cm)", uFactor: 1.7, description: "Alvenaria de alta capacidade térmica" },
  drywall_isolado: { id: "drywall_isolado", name: "Drywall com Lã de Rocha / Lã de Vidro (50mm)", uFactor: 0.7, description: "Gesso acartonado com excelente isolamento acústico e térmico" },
};

export const TELHADO_MATERIAIS: Record<RoofType, MaterialOption> = {
  laje_simples: { id: "laje_simples", name: "Laje de Concreto Simples (Sem Forro)", uFactor: 3.5, description: "Concreto armado sem isolamento adicional" },
  laje_isolada: { id: "laje_isolada", name: "Laje de Concreto com EPS / PIR Isolante", uFactor: 0.8, description: "Laje com camada de EPS de 50mm" },
  telha_fibro: { id: "telha_fibro", name: "Telha de Fibrocimento Simples", uFactor: 7.0, description: "Alta transmitância térmica direta" },
  telha_ceram_forro: { id: "telha_ceram_forro", name: "Telha Cerâmica com Forro de Gesso / Madeira", uFactor: 2.5, description: "Cobertura residencial tradicional" },
  telhado_verde: { id: "telhado_verde", name: "Telhado Verde Extensivo (Vegetado)", uFactor: 1.5, description: "Camada de substrato vegetal com amortecimento de picos solares" },
};

export const VIDRO_MATERIAIS: Record<GlassType, MaterialOption> = {
  simples: { id: "simples", name: "Vidro Simples Transparente (4mm a 6mm)", uFactor: 5.7, description: "Janelas e portas convencionais" },
  duplo: { id: "duplo", name: "Vidro Duplo Insulado com Câmara de Ar (6+12+6mm)", uFactor: 2.8, description: "Vidro insulado com câmara de argônio/ar seco" },
};

export const PRESET_EQUIPAMENTOS_CATALOGO = [
  { name: "Computador Desktop + Monitor", watts: 300 },
  { name: "Notebook Profissional", watts: 75 },
  { name: "Servidor Rack Small (1U)", watts: 450 },
  { name: "Televisor LED 55-65\"", watts: 160 },
  { name: "Console de Video Game", watts: 200 },
  { name: "Impressora Laser Multifuncional", watts: 400 },
  { name: "Refrigerador Comercial / Frigobar", watts: 180 },
  { name: "Cafeteira Elétrica Industrial", watts: 800 },
  { name: "Projetor Multimídia High Lumen", watts: 350 },
];
