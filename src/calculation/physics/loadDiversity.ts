import { ActivityType } from '../../types/hvac';

/**
 * Returns the hourly load diversity factor (0.1 to 1.0) for internal gains (occupancy, equipment, lighting).
 * @param hour Hour of the day (0 to 23).
 * @param activity Activity profile (residencial, comercial_baixo, comercial_alto, cozinha).
 * @returns Diversity multiplier between 0.1 and 1.0.
 */
export const getHourlyDiversityFactor = (hour: number, activity: ActivityType): number => {
  const normalizedHour = ((hour % 24) + 24) % 24;

  switch (activity) {
    case 'residencial': {
      if (normalizedHour >= 22 || normalizedHour <= 6) {
        return 1.0;
      }
      if (normalizedHour >= 7 && normalizedHour <= 17) {
        return 0.4;
      }
      return 0.85;
    }

    case 'comercial_baixo': {
      if (normalizedHour < 7 || normalizedHour > 20) {
        return 0.1;
      }
      if (normalizedHour >= 9 && normalizedHour <= 17) {
        return 1.0;
      }
      return 0.5;
    }

    case 'comercial_alto': {
      if (normalizedHour < 6 || normalizedHour >= 23) {
        return 0.15;
      }
      if (normalizedHour >= 8 && normalizedHour <= 18) {
        return 1.0;
      }
      if (normalizedHour >= 19 && normalizedHour <= 22) {
        return 0.7;
      }
      return 0.4;
    }

    case 'cozinha': {
      if (normalizedHour < 6 || normalizedHour >= 23) {
        return 0.1;
      }
      if (normalizedHour >= 10 && normalizedHour <= 15) {
        return 1.0;
      }
      if (normalizedHour >= 18 && normalizedHour <= 22) {
        return 0.95;
      }
      return 0.5;
    }

    default:
      return 1.0;
  }
};
