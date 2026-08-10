import { 
  HVACEnvironment, 
  HVACResult24h, 
  HourlyLoadBreakdown, 
  ThermalBreakdown,
  Orientation 
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
import { 
  WATT_TO_BTU, 
  CARGA_PESSOA, 
  getHourlyAmbientTempFactor, 
  getEquipmentSuggestion,
  getWallUFactor,
  getRoofUFactor,
  getGlassUFactor
} from './abntEngine';

/**
 * Motor de Cálculo da Carga Térmica Dinâmica ISO 52016-1 / ISO 13790
 * (Balanço Térmico de 5 Resistências e 1 Capacitância - 5R1C)
 */
export const calculateISO24h = (env: HVACEnvironment): HVACResult24h => {
  const area = Math.max(0, env.area || 0);
  const height = Math.max(0, env.height || 0);
  const volume = area * height;

  const zonaObj = EXTENDED_ZONAS_BIOCLIMATICAS.find(z => z.id === env.zonaId) || EXTENDED_ZONAS_BIOCLIMATICAS[2];
  const maxDeltaT = zonaObj.deltaT;
  const windMultiplier = getWindInfiltrationMultiplier(3.5);

  // 1. Coeficiente de Transferência por Transmissão H_tr (W/K)
  let H_tr_paredes = 0;
  (env.walls || []).forEach(wall => {
    const U = getWallUFactor(wall.type, env.customCatalog);
    H_tr_paredes += U * (wall.area || 0);
  });

  let H_tr_janelas = 0;
  (env.windows || []).forEach(win => {
    const U = getGlassUFactor(win.glassType, env.customCatalog);
    H_tr_janelas += U * (win.area || 0);
  });

  let H_tr_telhado = 0;
  if (env.hasRoof) {
    const U = getRoofUFactor(env.roofType, env.customCatalog);
    H_tr_telhado += U * (env.roofArea || area);
  }

  // 2. Coeficiente de Ventilação H_ve (W/K)
  const q_v = ((volume * 0.5) / 3600) * windMultiplier; // m³/s
  const H_ve = 1200 * q_v; // Air density * spec heat ~ 1200 J/(m³·K)

  // 3. Capacitância Térmica da Zona C_m (J/K) - ISO 52016-1 Classe Média/Pesada (165 kJ/m²K)
  const Cm = 165000 * area; 
  let T_node = 24.0; // Temperatura inicial do nó de massa interior (°C)
  const T_setpoint = 24.0; // Setpoint de conforto (°C)

  const isoProfile: HourlyLoadBreakdown[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const tempFactor = getHourlyAmbientTempFactor(hour);
    const T_ext = T_setpoint + maxDeltaT * (tempFactor - 0.2);
    const deltaT_h = Math.max(1, T_ext - T_setpoint);
    const diversity = getHourlyDiversityFactor(hour, env.activity);

    // Ganhos Internos (W)
    const cargaPessoa = CARGA_PESSOA[env.activity] || 115;
    const pessWatts = (env.occupants || 0) * cargaPessoa * diversity;
    const ilumWatts = (env.lightingWatts || 0) * diversity;
    const equipWatts = (env.equipment || []).reduce(
      (acc, eq) => acc + (eq.watts || 0) * (eq.qty || 1), 0
    ) * diversity;

    // Ganhos Solares em Janelas e Paredes (W)
    let solarJanelasWatts = 0;
    (env.windows || []).forEach(win => {
      const rad = getHourlySolarRadiation(hour, win.orientation);
      solarJanelasWatts += (win.area || 0) * rad * (win.protection ?? 1.0) * 0.75; // Fator g ISO
    });

    let solarParedesWatts = 0;
    const maxRadByOrient: Record<Orientation, number> = { leste: 350, oeste: 380, norte: 180, sul: 120 };
    (env.walls || []).forEach(wall => {
      const rad = getHourlySolarRadiation(hour, wall.orientation);
      const maxRad = maxRadByOrient[wall.orientation] || 250;
      solarParedesWatts += (wall.area || 0) * (rad / (maxRad || 1)) * 12.0; // Absorção opaca ISO
    });

    let solarTelhadoWatts = 0;
    if (env.hasRoof) {
      const rad = getHourlySolarRadiation(hour, 'sul');
      solarTelhadoWatts = (env.roofArea || area) * (rad / 250) * 15.0;
    }

    // Atualização da temperatura da massa térmica T_node conforme ISO 52016-1
    const totalGainWatts = pessWatts + ilumWatts + equipWatts + solarJanelasWatts + solarParedesWatts + solarTelhadoWatts;
    const thermalInertiaDamping = (Cm / 3600) * (T_node - T_setpoint); // W
    T_node = T_setpoint + 0.05 * deltaT_h + 0.02 * (totalGainWatts / (Cm / 3600));

    // Carga Térmica por componente (em BTU/h) com acoplamento dinâmico 5R1C
    const infiltracao = Math.round(H_ve * deltaT_h * WATT_TO_BTU);
    const pessoas = Math.round(pessWatts * WATT_TO_BTU);
    const iluminacao = Math.round(ilumWatts * WATT_TO_BTU);
    const equipamentos = Math.round(equipWatts * WATT_TO_BTU);
    const telhado = Math.round((H_tr_telhado * deltaT_h + solarTelhadoWatts) * WATT_TO_BTU);
    const paredes = Math.round((H_tr_paredes * deltaT_h + solarParedesWatts + thermalInertiaDamping * 0.2) * WATT_TO_BTU);
    const janelas = Math.round((H_tr_janelas * deltaT_h + solarJanelasWatts) * WATT_TO_BTU);

    const total = infiltracao + pessoas + iluminacao + equipamentos + telhado + paredes + janelas;

    isoProfile.push({
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

  // Identifica a hora de pico no balanço ISO 52016-1
  let peakHour = 0;
  let peakTotalBTU = 0;
  isoProfile.forEach((hLoad, idx) => {
    if (hLoad.total > peakTotalBTU) {
      peakTotalBTU = hLoad.total;
      peakHour = idx;
    }
  });

  const peakBreakdown = isoProfile[peakHour];
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
    standardMode: 'ISO_52016',
    breakdown,
    total: peakTotalBTU,
    sugerida,
    potenciaEstimadaKW,
    hourlyProfile: isoProfile,
    peakHour,
    peakTotalBTU
  };
};
