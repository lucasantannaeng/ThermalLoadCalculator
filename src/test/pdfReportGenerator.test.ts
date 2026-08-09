import { describe, it, expect, vi } from 'vitest';
import { generateHVACPDFReport } from '../services/pdfReportGenerator';
import { ProjectInfo, HVACResult24h } from '../types/hvac';

const mockProject: ProjectInfo = {
  name: 'Edifício Sede Tech',
  client: 'Empresa ACME Brasil',
  date: '2026-08-09'
};

const mockResults: HVACResult24h[] = [
  {
    id: 'env-1',
    name: 'Sala de Reunião Principal',
    standardMode: 'ABNT',
    total: 24500,
    sugerida: 'Split High Wall 24.000 BTU/h Inverter',
    potenciaEstimadaKW: 7.18,
    peakHour: 15,
    peakTotalBTU: 24500,
    breakdown: {
      infiltracao: 2000,
      pessoas: 4500,
      iluminacao: 3000,
      equipamentos: 3000,
      telhado: 4000,
      paredes: 4000,
      janelas: 4000
    },
    hourlyProfile: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      infiltracao: 1000,
      pessoas: 2000,
      iluminacao: 1500,
      equipamentos: 1500,
      telhado: i >= 6 && i <= 18 ? 3000 : 500,
      paredes: i >= 6 && i <= 18 ? 3000 : 500,
      janelas: i >= 6 && i <= 18 ? 3000 : 500,
      total: i === 15 ? 24500 : 15000
    }))
  },
  {
    id: 'env-2',
    name: 'Auditório Central',
    standardMode: 'ASHRAE_RTS',
    total: 60000,
    sugerida: 'Sistema RoofTop / Ductless 60.000 BTU/h',
    potenciaEstimadaKW: 17.58,
    peakHour: 14,
    peakTotalBTU: 60000,
    breakdown: {
      infiltracao: 5000,
      pessoas: 25000,
      iluminacao: 8000,
      equipamentos: 4000,
      telhado: 6000,
      paredes: 6000,
      janelas: 6000
    },
    hourlyProfile: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      infiltracao: 3000,
      pessoas: 15000,
      iluminacao: 5000,
      equipamentos: 3000,
      telhado: 4000,
      paredes: 4000,
      janelas: 4000,
      total: i === 14 ? 60000 : 38000
    }))
  }
];

describe('pdfReportGenerator - Gerador de Laudos Técnicos', () => {
  it('deve exportar a função de geração de laudo generateHVACPDFReport', () => {
    expect(typeof generateHVACPDFReport).toBe('function');
  });

  it('deve gerar o laudo PDF completo sem erros para múltiplos ambientes', () => {
    expect(() => {
      generateHVACPDFReport(mockProject, mockResults);
    }).not.toThrow();
  });

  it('deve gerar laudo mesmo com lista vazia de resultados', () => {
    expect(() => {
      generateHVACPDFReport(mockProject, []);
    }).not.toThrow();
  });

  it('deve gerar laudo para projeto sem nome ou cliente informados', () => {
    expect(() => {
      generateHVACPDFReport({ name: '', client: '', date: '' }, mockResults);
    }).not.toThrow();
  });

  it('deve gerar laudo com ambiente configurado na norma ISO 52016-1 e perfil 24h completo', () => {
    const isoResults: HVACResult24h[] = [
      {
        ...mockResults[0],
        standardMode: 'ISO_52016',
        name: 'Laboratório ISO 52016'
      }
    ];

    expect(() => {
      generateHVACPDFReport(mockProject, isoResults);
    }).not.toThrow();
  });

  it('deve lidar adequadamente com paginação para múltiplos ambientes (mais de 4 ambientes)', () => {
    const manyResults: HVACResult24h[] = Array.from({ length: 5 }, (_, i) => ({
      ...mockResults[i % 2],
      id: `env-multi-${i}`,
      name: `Ambiente Industrial ${i + 1}`
    }));

    expect(() => {
      generateHVACPDFReport(mockProject, manyResults);
    }).not.toThrow();
  });
});
