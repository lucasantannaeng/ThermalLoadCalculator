import { describe, it, expect, beforeEach } from 'vitest';
import { defaultActivityService, INITIAL_ACTIVITIES } from '../services/activityService';

describe('ActivityService - Gerenciador de Atividades HVAC', () => {
  beforeEach(async () => {
    await defaultActivityService.saveActivities(JSON.parse(JSON.stringify(INITIAL_ACTIVITIES)));
  });

  it('deve retornar as atividades pré-cadastradas', async () => {
    const list = await defaultActivityService.getActivities();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some(a => a.id.includes('residencial'))).toBe(true);
  });

  it('deve adicionar uma nova atividade com sucesso', async () => {
    const before = await defaultActivityService.getActivities();
    const countBefore = before.length;

    await defaultActivityService.addActivity({
      id: 'custom_crossfit',
      name: 'Crossfit / Treino de Alta Intensidade',
      metabolicRateW: 300,
      sensibleFraction: 0.45,
      latentFraction: 0.55,
      wattsPerSqMeter: 15,
      description: 'Atividade de altíssimo consumo metabólico.'
    });

    const updated = await defaultActivityService.getActivities();
    expect(updated.length).toBe(countBefore + 1);
    expect(updated.find(a => a.id === 'custom_crossfit')?.metabolicRateW).toBe(300);
  });

  it('deve remover uma atividade por id', async () => {
    const list = await defaultActivityService.getActivities();
    const targetId = list[0].id;
    await defaultActivityService.removeActivity(targetId);
    const updated = await defaultActivityService.getActivities();
    expect(updated.some(a => a.id === targetId)).toBe(false);
  });

  it('deve exportar para CSV contendo cabeçalho correto', () => {
    const csv = defaultActivityService.exportToCSV();
    expect(csv).toContain('id,nome,metabolicRateW');
  });
});
