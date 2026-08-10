import { 
  HVACEnvironment, 
  HVACResult24h, 
  HourlyLoadBreakdown, 
  ThermalBreakdown,
  Orientation,
  MaterialCatalog,
  MaterialOption
} from '../../types/hvac';
import { 
  EXTENDED_ZONAS_BIOCLIMATICAS, 
  PAREDE_MATERIAIS, 
  TELHADO_MATERIAIS, 
  VIDRO_MATERIAIS 
} from '../../data/hvacPresets';
import { getHourlySolarRadiation } from '../physics/solarRadiation';
import { getWindInfiltrationMultiplier } from '../physics/windInfiltration';
import { getHourlyDiversityFactor } from '../physics/loadDiversity';

export const WATT_TO_BTU = 3.41214;
export const CAPACIDADES_COMERCIAIS = [7500, 9000, 12000, 18000, 22000, 24000, 30000, 36000, 48000, 60000];

export const CLTD_PAREDE: Record<Orientation, number> = { norte: 7, sul: 4, leste: 6, oeste: 14 };
export const CARGA_PESSOA: Record<string, number> = { residencial: 115, comercial_baixo: 130, comercial_alto: 150, cozinha: 130 };

/**
 * Normalizes hourly ambient temperature profile scale (0.0 to 1.0) peaking around 14h-15h.
 */
export const getHourlyAmbientTempFactor = (hour: number): number => {
  const normHour = ((hour % 24) + 24) % 24;
  if (normHour < 6) return 0.2;
  if (normHour >= 6 && normHour <= 14) {
    return 0.2 + 0.8 * Math.sin(((normHour - 6) * Math.PI) / 16);
  }
  // 15 to 23
  return Math.max(0.2, 1.0 - 0.8 * ((normHour - 14) / 10));
};

export const getEquipmentSuggestion = (totalBTU: number) => {
  const capacidadeNecessaria = totalBTU * 1.1;
  const sugeridaBTU = CAPACIDADES_COMERCIAIS.find(c => c >= capacidadeNecessaria);
  const sugerida = sugeridaBTU 
    ? `${sugeridaBTU.toLocaleString('pt-BR')} BTU/h` 
    : "Superior a 60.000 BTU/h (Sistema VRF / Chiller recomendado)";
  const potenciaEstimadaKW = Number(((totalBTU / 12000) * 1.1).toFixed(2));
  return { sugerida, potenciaEstimadaKW };
};

export const getWallUFactor = (type: string, catalog?: MaterialCatalog): number => {
  if (catalog?.paredes) {
    const custom = catalog.paredes.find(m => m.id === type);
    if (custom) return custom.uFactor;
  }
  const preset = PAREDE_MATERIAIS[type as keyof typeof PAREDE_MATERIAIS];
  return preset ? preset.uFactor : 2.9;
};

export const getRoofUFactor = (type: string, catalog?: MaterialCatalog): number => {
  if (catalog?.telhados) {
    const custom = catalog.telhados.find(m => m.id === type);
    if (custom) return custom.uFactor;
  }
  const preset = TELHADO_MATERIAIS[type as keyof typeof TELHADO_MATERIAIS];
  return preset ? preset.uFactor : 2.0;
};

export const getGlassUFactor = (type: string, catalog?: MaterialCatalog): number => {
  if (catalog?.vidros) {
    const custom = catalog.vidros.find(m => m.id === type);
    if (custom) return custom.uFactor;
  }
  const preset = VIDRO_MATERIAIS[type as keyof typeof VIDRO_MATERIAIS];
  return preset ? preset.uFactor : 5.7;
};

/**
 * Motor de Cálculo da Carga Térmica Normativa ABNT NBR 16401 & 15220 - Perfil 24 Horas
 */
export const calculateABNT24h = (env: HVACEnvironment): HVACResult24h => {
  const area = Math.max(0, env.area || 0);
  const height = Math.max(0, env.height || 0);
  const volume = area * height;

  const zonaObj = EXTENDED_ZONAS_BIOCLIMATICAS.find(z => z.id === env.zonaId) || EXTENDED_ZONAS_BIOCLIMATICAS[2];
  const maxDeltaT = zonaObj.deltaT;
  const windMultiplier = getWindInfiltrationMultiplier(3.5);

  const hourlyProfile: HourlyLoadBreakdown[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const tempFactor = getHourlyAmbientTempFactor(hour);
    const hourlyDeltaT = Math.max(2, maxDeltaT * (0.3 + 0.7 * tempFactor));
    const diversity = getHourlyDiversityFactor(hour, env.activity);

    // 1. Infiltração
    const infiltracaoWatts = ((volume * 0.5) / 3600) * 1.225 * 1006 * hourlyDeltaT * windMultiplier;
    const infiltracao = Math.round(infiltracaoWatts * WATT_TO_BTU);

    // 2. Ocupantes
    const cargaPessoaPadrão = CARGA_PESSOA[env.activity] || 115;
    const pessoasWatts = (env.occupants || 0) * cargaPessoaPadrão * diversity;
    const pessoas = Math.round(pessoasWatts * WATT_TO_BTU);

    // 3. Iluminação
    const iluminacaoWatts = (env.lightingWatts || 0) * diversity;
    const iluminacao = Math.round(iluminacaoWatts * WATT_TO_BTU);

    // 4. Equipamentos
    const equipamentosWatts = (env.equipment || []).reduce(
      (acc, eq) => acc + (eq.watts || 0) * (eq.qty || 1), 0
    ) * diversity;
    const equipamentos = Math.round(equipamentosWatts * WATT_TO_BTU);

    // 5. Cobertura / Telhado
    let telhado = 0;
    if (env.hasRoof) {
      const U = getRoofUFactor(env.roofType, env.customCatalog);
      const roofSolarRad = getHourlySolarRadiation(hour, 'sul'); // ou equivalente zênite
      const cltdRoof = 5 + 15 * (tempFactor * 0.5 + (roofSolarRad / 250) * 0.5);
      const telhadoWatts = U * (env.roofArea || area) * cltdRoof;
      telhado = Math.round(telhadoWatts * WATT_TO_BTU);
    }

    // 6. Paredes
    const maxRadByOrient: Record<Orientation, number> = { leste: 350, oeste: 380, norte: 180, sul: 120 };
    let paredesWatts = 0;
    (env.walls || []).forEach(wall => {
      const U = getWallUFactor(wall.type, env.customCatalog);
      const baseCLTD = CLTD_PAREDE[wall.orientation] || 8;
      const wallRad = getHourlySolarRadiation(hour, wall.orientation);
      const maxRad = maxRadByOrient[wall.orientation] || 250;
      const solarRatio = maxRad > 0 ? wallRad / maxRad : 0;
      const cltdH = baseCLTD * (0.4 + 0.6 * solarRatio * tempFactor);
      paredesWatts += U * (wall.area || 0) * cltdH;
    });
    const paredes = Math.round(paredesWatts * WATT_TO_BTU);

    // 7. Janelas (Condução + Radiação Solar)
    let janelasConducaoWatts = 0;
    let janelasSolarWatts = 0;
    (env.windows || []).forEach(win => {
      const U = getGlassUFactor(win.glassType, env.customCatalog);
      janelasConducaoWatts += U * (win.area || 0) * hourlyDeltaT;
      const winRad = getHourlySolarRadiation(hour, win.orientation);
      janelasSolarWatts += (win.area || 0) * winRad * (win.protection ?? 1.0);
    });
    const janelas = Math.round((janelasConducaoWatts + janelasSolarWatts) * WATT_TO_BTU);

    const total = infiltracao + pessoas + iluminacao + equipamentos + telhado + paredes + janelas;

    hourlyProfile.push({
      hour,
      infiltracao,
      pessoas,
      iluminacao,
      equipamentos,
      telhado,
      paredes,
      janelas,
      total
    });
  }

  // Identifica a hora de pico
  let peakHour = 0;
  let peakTotalBTU = 0;
  hourlyProfile.forEach((hLoad, idx) => {
    if (hLoad.total > peakTotalBTU) {
      peakTotalBTU = hLoad.total;
      peakHour = idx;
    }
  });

  const peakBreakdown = hourlyProfile[peakHour];
  const breakdown: ThermalBreakdown = {
    infiltracao: peakBreakdown.infiltracao,
    pessoas: peakBreakdown.pessoas,
    iluminacao: peakBreakdown.iluminacao,
    equipamentos: peakBreakdown.equipamentos,
    telhado: peakBreakdown.telhado,
    paredes: peakBreakdown.paredes,
    janelas: peakBreakdown.janelas
  };

  const { sugerida, potenciaEstimadaKW } = getEquipmentSuggestion(peakTotalBTU);

  return {
    id: env.id,
    name: env.name || "Ambiente Sem Nome",
    standardMode: 'ABNT',
    breakdown,
    total: peakTotalBTU,
    sugerida,
    potenciaEstimadaKW,
    hourlyProfile,
    peakHour,
    peakTotalBTU
  };
};
