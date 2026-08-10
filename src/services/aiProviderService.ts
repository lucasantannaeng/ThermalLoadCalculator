export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  active: boolean;
  baseUrl?: string;
  customModel?: string;
}

export const PROVIDER_DISPLAY_NAMES: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  groq: 'Groq Cloud',
  openrouter: 'OpenRouter'
};

export const DEFAULT_PROVIDER_MODELS: Record<AiProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'meta-llama/llama-3.3-70b-instruct',
    'google/gemini-2.0-flash-001'
  ]
};

export const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

const STORAGE_KEY_CONFIGS = 'hvac_ai_provider_configs';
const STORAGE_KEY_ACTIVE = 'hvac_ai_active_provider';

// In-memory fallback if localStorage is unavailable (e.g., node test environment without jsdom)
let inMemoryConfigs: Record<string, AiProviderConfig> = {};
let inMemoryActiveProvider: AiProvider | null = null;

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
  * Obterm todas as configurações de provedores AI armazenadas.
  */
export function getProviderConfigs(): Record<AiProvider, AiProviderConfig | null> {
  const result: Record<AiProvider, AiProviderConfig | null> = {
    openai: null,
    anthropic: null,
    gemini: null,
    groq: null,
    openrouter: null
  };

  if (isLocalStorageAvailable()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.keys(result).forEach((p) => {
          if (parsed[p]) {
            result[p as AiProvider] = parsed[p];
          }
        });
      }
    } catch (e) {
      console.error('Erro ao ler configurações de API do localStorage:', e);
    }
  } else {
    Object.keys(result).forEach((p) => {
      if (inMemoryConfigs[p]) {
        result[p as AiProvider] = inMemoryConfigs[p];
      }
    });
  }

  return result;
}

/**
  * Obtém a configuração de um provedor específico.
  */
export function getProviderConfig(provider: AiProvider): AiProviderConfig | null {
  const configs = getProviderConfigs();
  return configs[provider] || null;
}

/**
  * Salva a configuração de um provedor de AI.
  */
export function saveProviderConfig(config: AiProviderConfig): void {
  const configs = getProviderConfigs();
  configs[config.provider] = config;

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
    } catch (e) {
      console.error('Erro ao salvar configuração de API no localStorage:', e);
    }
  } else {
    inMemoryConfigs[config.provider] = config;
  }

  if (config.active) {
    setActiveProvider(config.provider);
  }
}

/**
  * Remove a chave/configuração de um provedor.
  */
export function removeProviderConfig(provider: AiProvider): void {
  const configs = getProviderConfigs();
  delete configs[provider];

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
    } catch (e) {
      console.error('Erro ao remover provedor do localStorage:', e);
    }
  } else {
    delete inMemoryConfigs[provider];
  }

  const active = getActiveProvider();
  if (active?.provider === provider) {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    } else {
      inMemoryActiveProvider = null;
    }
  }
}

/**
  * Define qual provedor está atualmente ativo para requisições de IA.
  */
export function setActiveProvider(provider: AiProvider): void {
  const configs = getProviderConfigs();

  Object.keys(configs).forEach((p) => {
    const key = p as AiProvider;
    if (configs[key]) {
      configs[key]!.active = key === provider;
    }
  });

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
      localStorage.setItem(STORAGE_KEY_ACTIVE, provider);
    } catch (e) {
      console.error('Erro ao definir provedor ativo no localStorage:', e);
    }
  } else {
    Object.keys(inMemoryConfigs).forEach((p) => {
      inMemoryConfigs[p].active = p === provider;
    });
    inMemoryActiveProvider = provider;
  }
}

/**
  * Obtém a configuração do provedor atualmente ativo.
  */
export function getActiveProvider(): AiProviderConfig | null {
  let activeProviderName: AiProvider | null = null;

  if (isLocalStorageAvailable()) {
    activeProviderName = (localStorage.getItem(STORAGE_KEY_ACTIVE) as AiProvider) || null;
  } else {
    activeProviderName = inMemoryActiveProvider;
  }

  if (!activeProviderName) {
    const configs = getProviderConfigs();
    const activeEntry = Object.values(configs).find((c) => c && c.active);
    return activeEntry || null;
  }

  return getProviderConfig(activeProviderName);
}

/**
  * Testa a conexão e autenticação da chave API com o provedor escolhido.
  */
export async function testConnection(
  provider: AiProvider,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, message: 'Chave de API não informada.' };
  }

  const startTime = Date.now();
  const effectiveModel = model || DEFAULT_PROVIDER_MODELS[provider][0];

  try {
    let response: Response;

    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      const endpoint = baseUrl || DEFAULT_BASE_URLS[provider];
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      };

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://thermal-load-calculator.app';
        headers['X-Title'] = 'HVAC Thermal Load Calculator';
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: effectiveModel,
          messages: [{ role: 'user', content: 'Ping test. Responda APENAS com OK.' }],
          max_tokens: 5,
          temperature: 0.1
        })
      });
    } else if (provider === 'anthropic') {
      const endpoint = baseUrl || DEFAULT_BASE_URLS.anthropic;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: effectiveModel,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Ping test. Responda APENAS com OK.' }]
        })
      });
    } else if (provider === 'gemini') {
      const url = `${baseUrl || DEFAULT_BASE_URLS.gemini}/${effectiveModel}:generateContent?key=${apiKey.trim()}`;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Ping test. Responda APENAS com OK.' }]
            }
          ],
          generationConfig: { maxOutputTokens: 5 }
        })
      });
    } else {
      return { success: false, message: 'Provedor desconhecido.' };
    }

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        message: `Conexão bem-sucedida com ${PROVIDER_DISPLAY_NAMES[provider]}! (${latencyMs}ms)`,
        latencyMs
      };
    } else {
      const errorText = await response.text().catch(() => '');
      let detail = `Status HTTP ${response.status}`;
      try {
        const jsonErr = JSON.parse(errorText);
        if (jsonErr.error?.message) detail += `: ${jsonErr.error.message}`;
        else if (jsonErr.message) detail += `: ${jsonErr.message}`;
      } catch {
        if (errorText) detail += `: ${errorText.substring(0, 100)}`;
      }
      return { success: false, message: `Falha na autenticação. ${detail}` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar com ${PROVIDER_DISPLAY_NAMES[provider]}: ${err.message || 'Erro de rede ou CORS'}`
    };
  }
}

/**
  * Executa a geração de conclusão (prompt) via LLM para o provedor ativo ou especificado.
  */
export async function generateCompletion(
  prompt: string,
  systemPrompt?: string,
  configOverride?: AiProviderConfig
): Promise<string> {
  const config = configOverride || getActiveProvider();

  if (!config || !config.apiKey) {
    throw new Error('Nenhum provedor de IA configurado ou chave API ausente.');
  }

  const { provider, apiKey, model, baseUrl, customModel } = config;
  const effectiveModel = customModel || model || DEFAULT_PROVIDER_MODELS[provider][0];

  if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
    const endpoint = baseUrl || DEFAULT_BASE_URLS[provider];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://thermal-load-calculator.app';
      headers['X-Title'] = 'HVAC Thermal Load Calculator';
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: effectiveModel,
        messages,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API (${provider}): HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const endpoint = baseUrl || DEFAULT_BASE_URLS.anthropic;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: effectiveModel,
        max_tokens: 2048,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API (Anthropic): HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  if (provider === 'gemini') {
    const url = `${baseUrl || DEFAULT_BASE_URLS.gemini}/${effectiveModel}:generateContent?key=${apiKey.trim()}`;
    const fullText = systemPrompt ? `${systemPrompt}\n\nUser Input: ${prompt}` : prompt;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: fullText }]
          }
        ],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API (Gemini): HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Provedor de IA desconhecido: ${provider}`);
}
