import { Orientation } from '../../types/hvac';

/**
 * Calculates hourly solar radiation (W/m²) for a given orientation.
 * Peak radiation:
 * - Leste: ~9h (350 W/m²)
 * - Norte: ~12h (180 W/m²)
 * - Sul: ~12h (120 W/m²)
 * - Oeste: ~15h (380 W/m²)
 * Night period (hour < 6 or hour > 18) returns 0 W/m².
 */
export const getHourlySolarRadiation = (hour: number, orientation: Orientation): number => {
  if (hour < 6 || hour > 18) {
    return 0;
  }

  const peakHourMap: Record<Orientation, number> = {
    leste: 9,
    norte: 12,
    sul: 12,
    oeste: 15,
  };

  const maxRadMap: Record<Orientation, number> = {
    leste: 350,
    norte: 180,
    sul: 120,
    oeste: 380,
  };

  const peak = peakHourMap[orientation] ?? 12;
  const maxRad = maxRadMap[orientation] ?? 250;
  const deltaHour = Math.abs(hour - peak);

  if (deltaHour >= 4) {
    return 0;
  }

  return Math.max(0, Math.round(maxRad * Math.cos((deltaHour * Math.PI) / 8)));
};
