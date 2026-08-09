import { describe, it, expect } from 'vitest';
import { getHourlySolarRadiation } from '../calculation/physics/solarRadiation';
import { getWindInfiltrationMultiplier } from '../calculation/physics/windInfiltration';
import { getHourlyDiversityFactor } from '../calculation/physics/loadDiversity';
import { Orientation, ActivityType } from '../types/hvac';

describe('HVAC Physics Engines 24h', () => {
  describe('Solar Radiation (solarRadiation.ts)', () => {
    it('deve retornar 0 para o período noturno (horas < 6 ou > 18)', () => {
      const orientations: Orientation[] = ['norte', 'sul', 'leste', 'oeste'];
      orientations.forEach((orient) => {
        expect(getHourlySolarRadiation(0, orient)).toBe(0);
        expect(getHourlySolarRadiation(5, orient)).toBe(0);
        expect(getHourlySolarRadiation(19, orient)).toBe(0);
        expect(getHourlySolarRadiation(23, orient)).toBe(0);
      });
    });

    it('deve ter pico matutino (~9h) com ~350 W/m² para Leste', () => {
      const rad9 = getHourlySolarRadiation(9, 'leste');
      const rad6 = getHourlySolarRadiation(6, 'leste');
      const rad15 = getHourlySolarRadiation(15, 'leste');
      expect(rad9).toBe(350);
      expect(rad9).toBeGreaterThan(rad6);
      expect(rad9).toBeGreaterThan(rad15);
    });

    it('deve ter pico vespertino (~15h) com ~380 W/m² para Oeste', () => {
      const rad15 = getHourlySolarRadiation(15, 'oeste');
      const rad12 = getHourlySolarRadiation(12, 'oeste');
      const rad8 = getHourlySolarRadiation(8, 'oeste');
      expect(rad15).toBe(380);
      expect(rad15).toBeGreaterThan(rad12);
      expect(rad15).toBeGreaterThan(rad8);
    });

    it('deve ter pico ao meio-dia (~12h) para Norte e Sul', () => {
      const radNorte12 = getHourlySolarRadiation(12, 'norte');
      const radNorte8 = getHourlySolarRadiation(8, 'norte');
      expect(radNorte12).toBe(180);
      expect(radNorte12).toBeGreaterThan(radNorte8);

      const radSul12 = getHourlySolarRadiation(12, 'sul');
      const radSul8 = getHourlySolarRadiation(8, 'sul');
      expect(radSul12).toBe(120);
      expect(radSul12).toBeGreaterThan(radSul8);
    });
  });

  describe('Wind Infiltration (windInfiltration.ts)', () => {
    it('deve retornar multiplicador padrão de infiltração para vento de 3.5 m/s', () => {
      const multDefault = getWindInfiltrationMultiplier();
      expect(multDefault).toBeGreaterThan(1.0);
    });

    it('deve aumentar o multiplicador com o aumento da velocidade do vento', () => {
      const multCalmo = getWindInfiltrationMultiplier(1.0);
      const multMedio = getWindInfiltrationMultiplier(3.5);
      const multForte = getWindInfiltrationMultiplier(10.0);

      expect(multMedio).toBeGreaterThan(multCalmo);
      expect(multForte).toBeGreaterThan(multMedio);
    });

    it('deve considerar a pressão eólica P = 0.612 V²', () => {
      // Para V = 0, multiplicador deve ser 1.0 (sem acréscimo de vento)
      expect(getWindInfiltrationMultiplier(0)).toBe(1.0);
    });
  });

  describe('Load Diversity (loadDiversity.ts)', () => {
    it('deve retornar fatores de diversidade entre 0.1 e 1.0 para todas as atividades e 24 horas', () => {
      const activities: ActivityType[] = ['residencial', 'comercial_baixo', 'comercial_alto', 'cozinha'];
      for (const act of activities) {
        for (let hour = 0; hour < 24; hour++) {
          const factor = getHourlyDiversityFactor(hour, act);
          expect(factor).toBeGreaterThanOrEqual(0.1);
          expect(factor).toBeLessThanOrEqual(1.0);
        }
      }
    });

    it('deve aplicar perfil residencial com alta ocupação à noite e baixa durante o dia', () => {
      const factorNoite = getHourlyDiversityFactor(23, 'residencial');
      const factorDia = getHourlyDiversityFactor(14, 'residencial');
      expect(factorNoite).toBe(1.0);
      expect(factorDia).toBeLessThan(factorNoite);
    });

    it('deve aplicar perfil comercial com pico em horário de expediente', () => {
      const factorTarde = getHourlyDiversityFactor(14, 'comercial_baixo');
      const factorMadrugada = getHourlyDiversityFactor(3, 'comercial_baixo');
      expect(factorTarde).toBe(1.0);
      expect(factorMadrugada).toBe(0.1);
    });

    it('deve aplicar perfil de cozinha com picos em horários de refeição', () => {
      const factorAlmoco = getHourlyDiversityFactor(12, 'cozinha');
      const factorJantar = getHourlyDiversityFactor(20, 'cozinha');
      const factorMadrugada = getHourlyDiversityFactor(3, 'cozinha');
      expect(factorAlmoco).toBe(1.0);
      expect(factorJantar).toBeGreaterThan(0.9);
      expect(factorMadrugada).toBe(0.1);
    });
  });
});
