import { 
  HVACEnvironment, 
  Wall, 
  Window, 
  Equipment, 
  Orientation, 
  ActivityType, 
  RoofType, 
  WallType 
} from '../types/hvac';
import { ParsedGeometry, TextToCadResult } from '../types/cad';
import { getActiveProvider, generateCompletion, PROVIDER_DISPLAY_NAMES } from './aiProviderService';

export type { ParsedGeometry, TextToCadResult };

const LLM_SYSTEM_PROMPT = `Você é um Engenheiro Especialista em HVAC e Sintetizador de Geometria CAD 3D (normas ABNT NBR 16401 e 15220).
Sua tarefa é analisar o texto descritivo do usuário sobre um ambiente/sala e extrair/sintetizar os parâmetros geométricos e térmicos exatos em formato JSON.

Sua resposta DEVE SER ESTRITAMENTE um objeto JSON válido, sem texto explicativo adicional nem marcação markdown fora do JSON.

Estrutura do JSON esperada:
{
  "environment": {
    "name": "Nome do Ambiente",
    "area": 50,
    "height": 2.8,
    "occupants": 5,
    "activity": "residencial" | "comercial_baixo" | "comercial_alto" | "cozinha",
    "zonaId": 3,
    "lightingWatts": 400,
    "hasRoof": true,
    "roofType": "laje_simples" | "laje_isolada" | "telha_fibro" | "telha_ceram_forro" | "telhado_verde",
    "roofArea": 50,
    "walls": [
      { "id": 1, "area": 14, "orientation": "norte", "type": "alvenaria_leve" }
    ],
    "windows": [
      { "id": 1, "area": 3, "orientation": "leste", "glassType": "simples", "protection": 0.6 }
    ],
    "equipment": [
      { "id": 1, "name": "Computador Desktop", "watts": 300, "qty": 4 }
    ]
  },
  "geometry": {
    "length": 10,
    "width": 5,
    "height": 2.8,
    "area": 50,
    "volume": 140
  },
  "warnings": []
}`;

/**
 * Parser Inteligente Text-to-CAD para Ambientes HVAC (Regras Offline NBR 16401).
 * Converte um texto descritivo (prompt) em uma estrutura geometrizada de alta precisão.
 */
export function parseTextToCad(
  prompt: string, 
  existingEnvId?: string, 
  existingEnvName?: string
): TextToCadResult {
  const warnings: string[] = [];
  const cleanPrompt = prompt.trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  // 1. Extração das Dimensões (ex: "10x8m", "10 x 8 m", "10m por 8m")
  let length = 6.0;
  let width = 5.0;

  const dimMatch = lowerPrompt.match(/(\d+(?:[.,]\d+)?)\s*(?:x|X|\*|por)\s*(\d+(?:[.,]\d+)?)\s*m?/);
  if (dimMatch) {
    length = parseFloat(dimMatch[1].replace(',', '.'));
    width = parseFloat(dimMatch[2].replace(',', '.'));
  } else {
    // Busca por área direta (ex: "área de 50m²", "50m2", "50 m²")
    const areaMatch = lowerPrompt.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|metros\s+quadrados)/);
    if (areaMatch) {
      const areaVal = parseFloat(areaMatch[1].replace(',', '.'));
      const side = Math.sqrt(areaVal);
      length = parseFloat(side.toFixed(2));
      width = parseFloat(side.toFixed(2));
    } else {
      warnings.push("Dimensões do ambiente não especificadas claramente. Assumindo 6.0m x 5.0m.");
    }
  }

  // 2. Extração do Pé-direito / Altura (ex: "3.5m de pé-direito", "pé-direito de 3.5m", "altura 3m")
  let height = 2.8;
  const heightMatch = lowerPrompt.match(/(\d+(?:[.,]\d+)?)\s*m?\s*(?:de\s*)?(?:pé[- ]?direito|altura|height)/)
    || lowerPrompt.match(/(?:pé[- ]?direito|altura|height)\s*(?:de|:|=)?\s*(\d+(?:[.,]\d+)?)\s*m?/);

  if (heightMatch) {
    height = parseFloat(heightMatch[1].replace(',', '.'));
  }

  const area = parseFloat((length * width).toFixed(2));
  const volume = parseFloat((area * height).toFixed(2));

  // 3. Identificação do Tipo de Atividade / Uso do Espaço
  let activity: ActivityType = 'comercial_baixo';
  if (/\b(salão|salao|loja|shopping|comércio|comercio|supermercado)\b/.test(lowerPrompt)) {
    activity = 'comercial_alto';
  } else if (/\b(escritório|escritorio|reunião|reuniao|consultório|consultorio|administração)\b/.test(lowerPrompt)) {
    activity = 'comercial_baixo';
  } else if (/\b(cozinha|gourmet|restaurante|lanchonete)\b/.test(lowerPrompt)) {
    activity = 'cozinha';
  } else if (/\b(quarto|dormitório|dormitorio|sala|residencial|casa|apartamento|suíte|suite)\b/.test(lowerPrompt)) {
    activity = 'residencial';
  }

  // 4. Extração do Número de Ocupantes / Pessoas
  let occupants = 2;
  const occupantsMatch = lowerPrompt.match(/(\d+)\s*(?:pessoas|ocupantes|pess|pax)/);
  if (occupantsMatch) {
    occupants = parseInt(occupantsMatch[1], 10);
  } else {
    // Estimativa baseada no tipo de atividade e área
    if (activity === 'comercial_alto') occupants = Math.max(2, Math.round(area / 6));
    else if (activity === 'comercial_baixo') occupants = Math.max(2, Math.round(area / 8));
    else occupants = 2;
  }

  // 5. Extração de Janelas / Aberturas
  const windows: Window[] = [];
  let windowIdCounter = 1;

  // Procura padrões como "2 janelas na parede leste", "1 janela ao sul", "3 janelas a oeste"
  const windowRegex = /(\d+)?\s*(?:janela|janelas|esquadria|esquadrias)(?:\s+(?:na|no|em|ao|à|para|a)?\s*(?:parede)?)?\s*(?:na|no|em|ao|à|para|a)?\s*(norte|sul|leste|oeste)?/g;
  let winMatch: RegExpExecArray | null;

  while ((winMatch = windowRegex.exec(lowerPrompt)) !== null) {
    const qty = winMatch[1] ? parseInt(winMatch[1], 10) : 1;
    const orient = (winMatch[2] as Orientation) || 'leste';

    for (let i = 0; i < qty; i++) {
      windows.push({
        id: windowIdCounter++,
        area: 2.5, // m² por janela padrão
        orientation: orient,
        glassType: lowerPrompt.includes('duplo') ? 'duplo' : 'simples',
        protection: lowerPrompt.includes('persiana') ? 0.3 : (lowerPrompt.includes('cortina') ? 0.6 : 1.0)
      });
    }
  }

  // Se nenhuma janela foi informada no prompt, adiciona 1 janela padrão para realismo
  if (windows.length === 0) {
    windows.push({
      id: 1,
      area: parseFloat(Math.min(4, Math.max(1.5, area * 0.08)).toFixed(1)),
      orientation: 'leste',
      glassType: 'simples',
      protection: 0.6
    });
  }

  // 6. Configuração de Paredes Externas
  const wallType: WallType = lowerPrompt.includes('drywall') ? 'drywall_isolado' 
    : (lowerPrompt.includes('pesada') || lowerPrompt.includes('concreto') ? 'alvenaria_pesada' : 'alvenaria_leve');

  const walls: Wall[] = [
    { id: 1, area: parseFloat((length * height).toFixed(2)), orientation: 'norte', type: wallType },
    { id: 2, area: parseFloat((length * height).toFixed(2)), orientation: 'sul', type: wallType },
    { id: 3, area: parseFloat((width * height).toFixed(2)), orientation: 'leste', type: wallType },
    { id: 4, area: parseFloat((width * height).toFixed(2)), orientation: 'oeste', type: wallType }
  ];

  // 7. Iluminação e Cobertura / Telhado
  let lightingWatts = Math.round(area * 12); // Padrão ~12W/m²
  const lightMatch = lowerPrompt.match(/(\d+)\s*(?:w|watts)\s*(?:de\s*)?(?:iluminação|iluminacao|lâmpadas|lampadas)/);
  if (lightMatch) {
    lightingWatts = parseInt(lightMatch[1], 10);
  }

  let hasRoof = true;
  let roofType: RoofType = 'laje_isolada';
  if (/\b(sem telhado|andar intermediário|andar intermediario|piso intermediário)\b/.test(lowerPrompt)) {
    hasRoof = false;
  }
  if (lowerPrompt.includes('telhado verde')) roofType = 'telhado_verde';
  else if (lowerPrompt.includes('fibrocimento') || lowerPrompt.includes('fibro')) roofType = 'telha_fibro';
  else if (lowerPrompt.includes('telha cerâmica') || lowerPrompt.includes('forro')) roofType = 'telha_ceram_forro';
  else if (lowerPrompt.includes('laje simples')) roofType = 'laje_simples';

  // 8. Equipamentos Elétricos
  const equipment: Equipment[] = [];
  let equipIdCounter = 1;

  const equipPatterns = [
    { regex: /(\d+)\s*(?:computadores|computador|pcs|desktops)/, name: 'Computador Desktop + Monitor', watts: 300 },
    { regex: /(\d+)\s*(?:notebooks|laptops)/, name: 'Notebook / Laptop', watts: 90 },
    { regex: /(\d+)\s*(?:servidores|servidor|rack)/, name: 'Servidor Rack 1U', watts: 450 },
    { regex: /(\d+)\s*(?:projetores|projetor)/, name: 'Projetor Multimídia High Lumen', watts: 350 },
    { regex: /(\d+)\s*(?:impressoras|impressora|copiadora)/, name: 'Impressora / Copiadora Laser', watts: 250 },
    { regex: /(\d+)\s*(?:tvs|tv|televisores|monitores)/, name: 'Televisor / Monitor LED', watts: 150 },
    { regex: /(\d+)\s*(?:geladeiras|geladeira|refrigeradores|refrigerador|minibar)/, name: 'Refrigerador / Minibar', watts: 200 },
    { regex: /(\d+)\s*(?:ar[- ]condicionado|splits|split|fan coil)/, name: 'Unidade Evaporadora HVAC', watts: 800 }
  ];

  for (const pattern of equipPatterns) {
    const match = lowerPrompt.match(pattern.regex);
    if (match) {
      const qty = parseInt(match[1], 10);
      equipment.push({
        id: equipIdCounter++,
        name: pattern.name,
        watts: pattern.watts,
        qty: qty
      });
    }
  }

  // Nome do ambiente extraído ou gerado
  let name = existingEnvName || 'Ambiente CAD Gerado';
  if (!existingEnvName) {
    if (activity === 'comercial_alto') name = `Salão Comercial ${length}x${width}m`;
    else if (activity === 'comercial_baixo') name = `Escritório ${length}x${width}m`;
    else if (activity === 'cozinha') name = `Cozinha Industrial ${length}x${width}m`;
    else name = `Ambiente Residencial ${length}x${width}m`;
  }

  const environment: HVACEnvironment = {
    id: existingEnvId || `env-cad-${Math.random().toString(36).substring(2, 9)}`,
    name,
    area,
    height,
    occupants,
    activity,
    zonaId: 3, // São Paulo por padrão
    lightingWatts,
    hasRoof,
    roofType,
    roofArea: area,
    walls,
    windows,
    equipment
  };

  const geometry: ParsedGeometry = {
    length,
    width,
    height,
    area,
    volume
  };

  return {
    environment,
    geometry,
    rawPrompt: cleanPrompt,
    warnings,
    source: 'offline'
  };
}

/**
 * Parser Inteligente Text-to-CAD com suporte a Síntese LLM Multi-Provedor.
 * Tenta utilizar a API do LLM ativo (OpenAI, Anthropic, Gemini, Groq, OpenRouter).
 * Em caso de falha ou desativação, recorre transparentemente ao parser offline de regras.
 */
export async function parseTextToCadWithLlm(
  prompt: string,
  existingEnvId?: string,
  existingEnvName?: string,
  forceOffline: boolean = false
): Promise<TextToCadResult> {
  const activeProviderConfig = getActiveProvider();

  if (forceOffline || !activeProviderConfig || !activeProviderConfig.apiKey) {
    return parseTextToCad(prompt, existingEnvId, existingEnvName);
  }

  try {
    const rawResponse = await generateCompletion(prompt, LLM_SYSTEM_PROMPT, activeProviderConfig);
    
    // Sanitização e Extração de Bloco JSON
    let cleanJson = rawResponse.trim();
    if (cleanJson.includes('```')) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanJson = match[1].trim();
      }
    }

    const parsed = JSON.parse(cleanJson);

    if (!parsed.environment || !parsed.geometry) {
      throw new Error('Formato JSON retornado pelo LLM é inválido ou incompleto.');
    }

    const env = parsed.environment as HVACEnvironment;
    const geom = parsed.geometry as ParsedGeometry;

    // Ajusta ID e nome preservando referências se necessário
    env.id = existingEnvId || env.id || `env-llm-${Math.random().toString(36).substring(2, 9)}`;
    if (existingEnvName) env.name = existingEnvName;

    // Garantia de campos numéricos coerentes
    geom.length = Number(geom.length) || 5.0;
    geom.width = Number(geom.width) || 5.0;
    geom.height = Number(geom.height) || env.height || 2.8;
    geom.area = Number(geom.area) || parseFloat((geom.length * geom.width).toFixed(2));
    geom.volume = Number(geom.volume) || parseFloat((geom.area * geom.height).toFixed(2));

    env.area = geom.area;
    env.height = geom.height;
    env.roofArea = env.roofArea || geom.area;
    env.walls = Array.isArray(env.walls) && env.walls.length > 0 ? env.walls : [
      { id: 1, area: parseFloat((geom.length * geom.height).toFixed(2)), orientation: 'norte', type: 'alvenaria_leve' },
      { id: 2, area: parseFloat((geom.length * geom.height).toFixed(2)), orientation: 'sul', type: 'alvenaria_leve' },
      { id: 3, area: parseFloat((geom.width * geom.height).toFixed(2)), orientation: 'leste', type: 'alvenaria_leve' },
      { id: 4, area: parseFloat((geom.width * geom.height).toFixed(2)), orientation: 'oeste', type: 'alvenaria_leve' }
    ];
    env.windows = Array.isArray(env.windows) ? env.windows : [];
    env.equipment = Array.isArray(env.equipment) ? env.equipment : [];

    const warnings: string[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];

    return {
      environment: env,
      geometry: geom,
      rawPrompt: prompt.trim(),
      warnings,
      source: 'llm',
      providerName: PROVIDER_DISPLAY_NAMES[activeProviderConfig.provider]
    };
  } catch (err: any) {
    console.warn('Falha na síntese LLM Text-to-CAD. Acionando fallback offline:', err.message);
    const fallbackResult = parseTextToCad(prompt, existingEnvId, existingEnvName);
    fallbackResult.warnings.push(
      `Sintetizador LLM (${PROVIDER_DISPLAY_NAMES[activeProviderConfig.provider]}) falhou. Utilizado parser offline ABNT NBR 16401.`
    );
    fallbackResult.source = 'offline';
    return fallbackResult;
  }
}
