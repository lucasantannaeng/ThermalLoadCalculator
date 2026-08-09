import { 
  HVACEnvironment, 
  HVACResult24h, 
  HourlyLoadBreakdown, 
  ThermalBreakdown 
} from '../../types/hvac';
import { calculateABNT24h, getEquipmentSuggestion } from './abntEngine';

/**
 * Helper to get circular index in a 24h array
 */
const getCircular = (arr: number[], idx: number): number => {
  const n = arr.length;
  const wrapped = ((idx % n) + n) % n;
  return arr[wrapped];
};

/**
 * Motor de Cálculo da Carga Térmica ASHRAE Radiant Time Series (RTS) e CTF (Conduction Transfer Functions)
 */
export const calculateASHRAERTS24h = (env: HVACEnvironment): HVACResult24h => {
  // 1. Obter ganhos de calor instantâneos de base (24h) via ABNT/Física
  const baseResult = calculateABNT24h(env);
  const rawProfile = baseResult.hourlyProfile;

  // Extrair vetores brutos dos 24h
  const rawInf = rawProfile.map(p => p.infiltracao);
  const rawPess = rawProfile.map(p => p.pessoas);
  const rawIlum = rawProfile.map(p => p.iluminacao);
  const rawEquip = rawProfile.map(p => p.equipamentos);
  const rawTelhado = rawProfile.map(p => p.telhado);
  const rawParedes = rawProfile.map(p => p.paredes);
  const rawJanelas = rawProfile.map(p => p.janelas);

  const rtsProfile: HourlyLoadBreakdown[] = [];

  // Fatores de Divisão Convectiva / Radiante
  const PESS_CONV = 0.60, PESS_RAD = 0.40;
  const ILUM_CONV = 0.50, ILUM_RAD = 0.50;
  const EQUIP_CONV = 0.70, EQUIP_RAD = 0.30;
  const JANELA_CONV = 0.45, JANELA_RAD = 0.55;

  // 2. Aplicar matriz RTF (Radiant Time Series) e CTF sobre o perfil de 24h
  for (let h = 0; h < 24; h++) {
    // Infiltração: 100% Convectiva instantânea (sem atraso)
    const infiltracao = rawInf[h];

    // Pessoas: Convectiva instantânea + Radiante amortecida (RTF filter 55%, 30%, 15%)
    const pessConv = rawPess[h] * PESS_CONV;
    const pessRadGainH = rawPess[h] * PESS_RAD;
    const pessRadGainH1 = getCircular(rawPess, h - 1) * PESS_RAD;
    const pessRadGainH2 = getCircular(rawPess, h - 2) * PESS_RAD;
    const pessRadCooling = 0.55 * pessRadGainH + 0.30 * pessRadGainH1 + 0.15 * pessRadGainH2;
    const pessoas = Math.round(pessConv + pessRadCooling);

    // Iluminação: Convectiva + Radiante RTF
    const ilumConv = rawIlum[h] * ILUM_CONV;
    const ilumRadH = rawIlum[h] * ILUM_RAD;
    const ilumRadH1 = getCircular(rawIlum, h - 1) * ILUM_RAD;
    const ilumRadH2 = getCircular(rawIlum, h - 2) * ILUM_RAD;
    const ilumRadCooling = 0.55 * ilumRadH + 0.30 * ilumRadH1 + 0.15 * ilumRadH2;
    const iluminacao = Math.round(ilumConv + ilumRadCooling);

    // Equipamentos: Convectiva + Radiante RTF
    const equipConv = rawEquip[h] * EQUIP_CONV;
    const equipRadH = rawEquip[h] * EQUIP_RAD;
    const equipRadH1 = getCircular(rawEquip, h - 1) * EQUIP_RAD;
    const equipRadH2 = getCircular(rawEquip, h - 2) * EQUIP_RAD;
    const equipRadCooling = 0.55 * equipRadH + 0.30 * equipRadH1 + 0.15 * equipRadH2;
    const equipamentos = Math.round(equipConv + equipRadCooling);

    // Paredes: CTF (Conduction Transfer Function) delay nas superfícies pesadas (50% h, 35% h-1, 15% h-2)
    const paredes = Math.round(
      0.50 * rawParedes[h] + 0.35 * getCircular(rawParedes, h - 1) + 0.15 * getCircular(rawParedes, h - 2)
    );

    // Telhado: CTF delay (45% h, 35% h-1, 20% h-2)
    const telhado = Math.round(
      0.45 * rawTelhado[h] + 0.35 * getCircular(rawTelhado, h - 1) + 0.20 * getCircular(rawTelhado, h - 2)
    );

    // Janelas: Convectiva + Radiante RTF
    const janConv = rawJanelas[h] * JANELA_CONV;
    const janRadH = rawJanelas[h] * JANELA_RAD;
    const janRadH1 = getCircular(rawJanelas, h - 1) * JANELA_RAD;
    const janRadH2 = getCircular(rawJanelas, h - 2) * JANELA_RAD;
    const janRadCooling = 0.55 * janRadH + 0.30 * janRadH1 + 0.15 * janRadH2;
    const janelas = Math.round(janConv + janRadCooling);

    const total = infiltracao + pessoas + iluminacao + equipamentos + telhado + paredes + janelas;

    rtsProfile.push({
      hour: h,
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

  // Identifica a hora de pico no modelo RTS
  let peakHour = 0;
  let peakTotalBTU = 0;
  rtsProfile.forEach((hLoad, idx) => {
    if (hLoad.total > peakTotalBTU) {
      peakTotalBTU = hLoad.total;
      peakHour = idx;
    }
  });

  const peakBreakdown = rtsProfile[peakHour];
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
    standardMode: 'ASHRAE_RTS',
    breakdown,
    total: peakTotalBTU,
    sugerida,
    potenciaEstimadaKW,
    hourlyProfile: rtsProfile,
    peakHour,
    peakTotalBTU
  };
};
