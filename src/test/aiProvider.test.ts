import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AiProvider,
  AiProviderConfig,
  saveProviderConfig,
  getProviderConfigs,
  getProviderConfig,
  getActiveProvider,
  setActiveProvider,
  removeProviderConfig,
  testConnection,
  generateCompletion,
  DEFAULT_PROVIDER_MODELS
} from '../services/aiProviderService';
import { parseTextToCad, parseTextToCadWithLlm } from '../services/textToCadService';

describe('AI Multi-Provider Service & Text-to-CAD LLM Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reseta configurações limpas antes de cada teste
    const providers: AiProvider[] = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter'];
    providers.forEach(p => removeProviderConfig(p));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Gerenciamento e Armazenamento Local de Configurações Multi-Provedor', () => {
    it('deve salvar e recuperar configurações para OpenAI, Anthropic, Gemini, Groq e OpenRouter', () => {
      const openaiConfig: AiProviderConfig = {
        provider: 'openai',
        apiKey: 'sk-test-openai-12345',
        model: 'gpt-4o',
        active: false
      };

      const anthropicConfig: AiProviderConfig = {
        provider: 'anthropic',
        apiKey: 'sk-ant-test-67890',
        model: 'claude-3-5-sonnet-20241022',
        active: false
      };

      saveProviderConfig(openaiConfig);
      saveProviderConfig(anthropicConfig);

      const savedOpenAI = getProviderConfig('openai');
      const savedAnthropic = getProviderConfig('anthropic');

      expect(savedOpenAI).toBeDefined();
      expect(savedOpenAI?.apiKey).toBe('sk-test-openai-12345');
      expect(savedOpenAI?.model).toBe('gpt-4o');

      expect(savedAnthropic).toBeDefined();
      expect(savedAnthropic?.apiKey).toBe('sk-ant-test-67890');
      expect(savedAnthropic?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('deve definir e alternar corretamente o provedor ativo', () => {
      saveProviderConfig({
        provider: 'groq',
        apiKey: 'gsk-test-groq-key',
        model: 'llama-3.3-70b-versatile',
        active: false
      });

      saveProviderConfig({
        provider: 'gemini',
        apiKey: 'AIzaSy-test-gemini-key',
        model: 'gemini-2.0-flash',
        active: false
      });

      setActiveProvider('groq');
      let active = getActiveProvider();
      expect(active?.provider).toBe('groq');
      expect(active?.model).toBe('llama-3.3-70b-versatile');

      setActiveProvider('gemini');
      active = getActiveProvider();
      expect(active?.provider).toBe('gemini');
      expect(active?.model).toBe('gemini-2.0-flash');
    });

    it('deve remover a chave e limpar o provedor ativo se for o removido', () => {
      saveProviderConfig({
        provider: 'openrouter',
        apiKey: 'sk-or-test-key',
        model: 'anthropic/claude-3.5-sonnet',
        active: true
      });

      expect(getActiveProvider()?.provider).toBe('openrouter');

      removeProviderConfig('openrouter');
      expect(getProviderConfig('openrouter')).toBeNull();
      expect(getActiveProvider()).toBeNull();
    });
  });

  describe('2. Teste de Conexão das APIs (testConnection)', () => {
    it('deve retornar erro se a chave de API estiver vazia', async () => {
      const result = await testConnection('openai', '', 'gpt-4o');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Chave de API não informada');
    });

    it('deve testar a conexão com sucesso para OpenAI quando a API responde HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'OK' } }] })
      } as Response);

      const result = await testConnection('openai', 'sk-valid-key', 'gpt-4o');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Conexão bem-sucedida');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('deve capturar falhas de autenticação (HTTP 401) com mensagem detalhada', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Invalid API Key provided' } })
      } as Response);

      const result = await testConnection('anthropic', 'sk-invalid-key', 'claude-3-5-sonnet-20241022');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Falha na autenticação');
      expect(result.message).toContain('Invalid API Key');
    });
  });

  describe('3. Geração de Conclusões LLM (generateCompletion)', () => {
    it('deve fazer requisição para OpenAI / Groq no formato chat/completions', async () => {
      saveProviderConfig({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
        active: true
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Resposta simulada do GPT-4o' } }]
        })
      } as Response);

      const responseText = await generateCompletion('Quais são as regras ABNT?', 'Você é um assistente HVAC');
      expect(responseText).toBe('Resposta simulada do GPT-4o');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key'
          })
        })
      );
    });

    it('deve fazer requisição para Gemini no formato generateContent', async () => {
      saveProviderConfig({
        provider: 'gemini',
        apiKey: 'AIzaSy-valid-key',
        model: 'gemini-1.5-pro',
        active: true
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Resposta simulada do Gemini Pro' }] } }]
        })
      } as Response);

      const responseText = await generateCompletion('Carga térmica de sala');
      expect(responseText).toBe('Resposta simulada do Gemini Pro');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'),
        expect.any(Object)
      );
    });
  });

  describe('4. Síntese de Geometrias 3D HVAC Text-to-CAD via LLM com Fallback Offline', () => {
    it('deve sintetizar o ambiente 3D via LLM quando JSON válido é retornado', async () => {
      saveProviderConfig({
        provider: 'openai',
        apiKey: 'sk-valid-key',
        model: 'gpt-4o',
        active: true
      });

      const mockLlmJsonResponse = JSON.stringify({
        environment: {
          name: 'Auditório Principal 12x10m',
          area: 120,
          height: 4.0,
          occupants: 50,
          activity: 'comercial_alto',
          zonaId: 3,
          lightingWatts: 1500,
          hasRoof: true,
          roofType: 'laje_isolada',
          roofArea: 120,
          walls: [
            { id: 1, area: 48, orientation: 'norte', type: 'alvenaria_pesada' },
            { id: 2, area: 48, orientation: 'sul', type: 'alvenaria_pesada' }
          ],
          windows: [
            { id: 1, area: 12, orientation: 'leste', glassType: 'duplo', protection: 0.3 }
          ],
          equipment: [
            { id: 1, name: 'Projetor 4K', watts: 500, qty: 2 }
          ]
        },
        geometry: {
          length: 12,
          width: 10,
          height: 4.0,
          area: 120,
          volume: 480
        },
        warnings: []
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `\`\`\`json\n${mockLlmJsonResponse}\n\`\`\`` } }]
        })
      } as Response);

      const result = await parseTextToCadWithLlm('Auditório de 12x10m com 4m de pé-direito para 50 pessoas');

      expect(result.source).toBe('llm');
      expect(result.providerName).toBe('OpenAI');
      expect(result.environment.name).toBe('Auditório Principal 12x10m');
      expect(result.geometry.area).toBe(120);
      expect(result.geometry.volume).toBe(480);
      expect(result.environment.occupants).toBe(50);
    });

    it('deve fazer fallback transparente para o parser offline se nenhum LLM estiver configurado', async () => {
      const result = await parseTextToCadWithLlm('Escritório de 8x6m com pé-direito de 3m e 4 computadores');

      expect(result.source).toBe('offline');
      expect(result.geometry.length).toBe(8);
      expect(result.geometry.width).toBe(6);
      expect(result.geometry.height).toBe(3);
      expect(result.environment.equipment.length).toBeGreaterThan(0);
    });

    it('deve acionar o fallback offline com warning se a API do LLM falhar ou retornar erro', async () => {
      saveProviderConfig({
        provider: 'anthropic',
        apiKey: 'sk-ant-invalid',
        model: 'claude-3-5-sonnet-20241022',
        active: true
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error or rate limit exceeded'));

      const result = await parseTextToCadWithLlm('Cozinha industrial de 6x4m');

      expect(result.source).toBe('offline');
      expect(result.geometry.area).toBe(24);
      expect(result.warnings.some(w => w.includes('Sintetizador LLM (Anthropic (Claude)) falhou'))).toBe(true);
    });

    it('deve respeitar a opção forceOffline mesmo com LLM ativo', async () => {
      saveProviderConfig({
        provider: 'groq',
        apiKey: 'gsk-valid',
        model: 'llama-3.3-70b-versatile',
        active: true
      });

      const result = await parseTextToCadWithLlm('Sala de reunião 5x5m', undefined, undefined, true);

      expect(result.source).toBe('offline');
      expect(result.geometry.area).toBe(25);
    });
  });
});
