import { HVACEnvironment, HVACResult24h, StandardMode } from '../../types/hvac';
import { calculateABNT24h } from './abntEngine';
import { calculateASHRAERTS24h } from './ashraeRtsEngine';
import { calculateISO24h } from './isoEngine';

/**
 * Fábrica de Motores de Cálculo de Carga Térmica HVAC 24 Horas.
 * Despacha o cálculo para a norma selecionada (ABNT, ASHRAE RTS ou ISO 52016-1).
 */
export const calculateHVAC24h = (
  env: HVACEnvironment, 
  mode: StandardMode = 'ABNT'
): HVACResult24h => {
  switch (mode) {
    case 'ASHRAE_RTS':
      return calculateASHRAERTS24h(env);
    case 'ISO_52016':
      return calculateISO24h(env);
    case 'ABNT':
    default:
      return calculateABNT24h(env);
  }
};
