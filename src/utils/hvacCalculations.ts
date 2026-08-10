import { 
  HVACEnvironment, 
  HVACResult, 
  ThermalBreakdown, 
  Orientation, 
  RoofType, 
  WallType, 
  GlassType, 
  ActivityType,
  Equipment,
  Wall,
  Window
} from '../types/hvac';
import { 
  EXTENDED_ZONAS_BIOCLIMATICAS, 
  PAREDE_MATERIAIS, 
  TELHADO_MATERIAIS, 
  VIDRO_MATERIAIS 
} from '../data/hvacPresets';

export const WATT_TO_BTU = 3.41214;
export const DEFAULT_COP = 3.2; 
export const CAPACIDADES_COMERCIAIS = [7500, 9000, 12000, 18000, 22000, 24000, 30000, 36000, 48000, 60000];

export const CLTD_PAREDE: Record<Orientation, number> = { norte: 7, sul: 4, leste: 6, oeste: 14 };
export const SHGF_VIDRO: Record<Orientation, number> = { norte: 100, sul: 40, leste: 250, oeste: 340 };

export const CARGA_PESSOA: Record<ActivityType, number> = {
  residencial: 115,
  comercial_baixo: 130,
  comercial_alto: 150,
  cozinha: 130
};

/**
 * Motor de Cálculo da Carga Térmica Normativa ABNT NBR 16401 & NBR 15220
 */
export const calculateEnvironmentThermalLoad = (env: HVACEnvironment): HVACResult => {
  const area = Math.max(0, env.area || 0);
  const height = Math.max(0, env.height || 0);
  const volume = area * height;

  const zonaObj = EXTENDED_ZONAS_BIOCLIMATICAS.find(z => z.id === env.zonaId) || EXTENDED_ZONAS_BIOCLIMATICAS[2];
  const deltaT = zonaObj.deltaT;

  // 1. Infiltração e Renovação de Ar
  const infiltracaoWatts = ((volume * 0.5) / 3600) * 1.225 * 1006 * deltaT;
  const infiltracaoBTU = infiltracaoWatts * WATT_TO_BTU;

  // 2. Ocupantes
  const cargaPessoaWatts = (env.occupants || 0) * (CARGA_PESSOA[env.activity] || 115);
  const pessoasBTU = cargaPessoaWatts * WATT_TO_BTU;

  // 3. Iluminação
  const iluminacaoBTU = (env.lightingWatts || 0) * WATT_TO_BTU;

  // 4. Equipamentos Elétricos
  const equipamentosWatts = (env.equipment || []).reduce((acc: number, eq: Equipment) => acc + ((eq.watts || 0) * (eq.qty || 1)), 0);
  const equipamentosBTU = equipamentosWatts * WATT_TO_BTU;

  // 5. Cobertura / Telhado
  let telhadoBTU = 0;
  if (env.hasRoof) {
    const matObj = (env.customCatalog?.telhados?.find(m => m.id === env.roofType)) || TELHADO_MATERIAIS[env.roofType];
    const U = matObj ? matObj.uFactor : 2.0;
    const cltd = 15;
    telhadoBTU = U * (env.roofArea || area) * cltd * WATT_TO_BTU;
  }

  // 6. Paredes Externas
  const paredesBTU = (env.walls || []).reduce((acc: number, wall: Wall) => {
    const matObj = (env.customCatalog?.paredes?.find(m => m.id === wall.type)) || PAREDE_MATERIAIS[wall.type];
    const U = matObj ? matObj.uFactor : 2.9;
    const cltd = CLTD_PAREDE[wall.orientation] || 8;
    return acc + (U * (wall.area || 0) * cltd);
  }, 0) * WATT_TO_BTU;

  // 7. Aberturas Envidraçadas (Condução + Radiação Solar)
  let janelasConducaoWatts = 0;
  let janelasSolarWatts = 0;

  (env.windows || []).forEach((win: Window) => {
    const matObj = (env.customCatalog?.vidros?.find(m => m.id === win.glassType)) || VIDRO_MATERIAIS[win.glassType];
    const U = matObj ? matObj.uFactor : 5.7;
    janelasConducaoWatts += U * (win.area || 0) * deltaT;
    janelasSolarWatts += (win.area || 0) * (SHGF_VIDRO[win.orientation] || 150) * (win.protection || 1.0);
  });

  const janelasBTU = (janelasConducaoWatts + janelasSolarWatts) * WATT_TO_BTU;

  const breakdown: ThermalBreakdown = {
    infiltracao: Math.round(infiltracaoBTU),
    pessoas: Math.round(pessoasBTU),
    iluminacao: Math.round(iluminacaoBTU),
    equipamentos: Math.round(equipamentosBTU),
    telhado: Math.round(telhadoBTU),
    paredes: Math.round(paredesBTU),
    janelas: Math.round(janelasBTU)
  };

  const total = (Object.values(breakdown) as number[]).reduce((a: number, b: number) => a + b, 0);

  const capacidadeNecessaria = total * 1.1;
  const sugeridaBTU = CAPACIDADES_COMERCIAIS.find(c => c >= capacidadeNecessaria);
  const sugerida = sugeridaBTU ? `${sugeridaBTU.toLocaleString('pt-BR')} BTU/h` : "Superior a 60.000 BTU/h (Sistema VRF / Chiller recomendado)";

  const potenciaEstimadaKW = Number(((total / 12000) * 1.1).toFixed(2));

  return {
    id: env.id,
    name: env.name || "Ambiente Sem Nome",
    breakdown,
    total: Math.round(total),
    sugerida,
    potenciaEstimadaKW
  };
};
