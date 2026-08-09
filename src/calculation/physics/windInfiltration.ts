/**
 * Calculates the infiltration load multiplier based on wind speed (m/s).
 * Incorporates wind pressure formula: P = 0.612 * V² (Pa).
 * @param windSpeedMS Wind speed in meters per second (default: 3.5 m/s).
 * @returns Multiplier scaling air infiltration (>= 1.0).
 */
export const getWindInfiltrationMultiplier = (windSpeedMS: number = 3.5): number => {
  if (windSpeedMS <= 0) {
    return 1.0;
  }

  // Wind pressure calculation: P = 0.612 * V²
  const windPressure = 0.612 * Math.pow(windSpeedMS, 2);
  const baseSpeed = 2.0;
  const basePressure = 0.612 * Math.pow(baseSpeed, 2); // 2.448 Pa

  const pressureRatio = windPressure / basePressure;
  const multiplier = 1.0 + 0.15 * Math.pow(pressureRatio, 0.6);

  return Number(multiplier.toFixed(2));
};
