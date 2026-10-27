import { db } from './db.ts';
import type { RouteRecord, ReviewStatus, Differential, City } from './types.ts';
import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import { PDFDocument, degrees } from 'pdf-lib';
import { extractWithPaddleOCR, repairUtf8Mojibake } from './paddleOcr.ts';
import { extractWithRapidOCR } from './rapidOcr.ts';

const OPENAI_ROUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    client: { type: 'string' },
    originCity: { type: 'string' },
    originState: { type: ['string', 'null'] },
    priorityTariffTable: { type: 'boolean' },
    secondaryOriginCity: { type: ['string', 'null'] },
    destinationCity: { type: 'string' },
    destinationConfidence: { type: 'number' },
    differential: { type: 'string', enum: ['NORMAL', 'CPL', 'CIRCUITO', '-'] },
    records: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          vehicleType: { type: 'string' },
          totalValueRaw: { type: 'string' },
          numericValue: { type: ['number', 'null'] },
          freightWeightRaw: { type: ['string', 'null'] },
          tollRaw: { type: ['string', 'null'] },
          hasFreightBreakdown: { type: 'boolean' },
          confidence: { type: 'number' },
          notes: { type: ['string', 'null'] }
        },
        required: ['vehicleType', 'totalValueRaw', 'numericValue', 'freightWeightRaw', 'tollRaw', 'hasFreightBreakdown', 'confidence', 'notes']
      }
    }
  },
  required: ['client', 'originCity', 'originState', 'priorityTariffTable', 'secondaryOriginCity', 'destinationCity', 'destinationConfidence', 'differential', 'records']
} as const;

async function requestOpenAIExtraction(
  apiKey: string,
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  prompt: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_file',
              filename,
              file_data: `data:${mimeType || 'application/pdf'};base64,${fileBuffer.toString('base64')}`
            }
          ]
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'freight_route_extraction',
            strict: true,
            schema: OPENAI_ROUTE_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });
    const result = await response.json() as any;
    if (!response.ok) {
      const apiMessage = result?.error?.message || `HTTP ${response.status}`;
      if (response.status === 429) {
        throw new Error(`A cota ou o limite de uso da API da OpenAI foi atingido: ${apiMessage}`);
      }
      throw new Error(`Falha na API da OpenAI (${response.status}): ${apiMessage}`);
    }
    const outputText = typeof result.output_text === 'string'
      ? result.output_text
      : (result.output || []).flatMap((item: any) => item.content || [])
        .filter((item: any) => item.type === 'output_text')
        .map((item: any) => item.text || '')
        .join('');
    if (!outputText.trim()) throw new Error('A API da OpenAI não retornou os dados extraídos do PDF.');
    return outputText.trim();
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error('A leitura do PDF pela OpenAI excedeu 5 minutos. O arquivo continua salvo; tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOllamaExtraction(
  apiKey: string,
  fileBuffer: Buffer,
  filename: string,
  prompt: string
): Promise<string> {
  // Ollama Cloud's chat API accepts images rather than PDF attachments. Render
  // the PDF pages so handwritten tables are sent to a vision-capable model.
  // Try the original orientation first, then each quarter-turn. This handles
  // both portrait and landscape scans without assuming how the PDF was saved.
  const orientationTurns = [0, 90, 270, 180];
  let totalPages = 0;
  try {
    totalPages = (await PDFDocument.load(fileBuffer)).getPages().length;
  } catch (error) {
    throw new Error(`Não foi possível abrir o PDF para testar sua orientação no OCR do Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (totalPages > 20) {
    throw new Error(`O OCR pelo Ollama Cloud aceita PDFs de até 20 páginas por vez; este arquivo tem ${totalPages}. Divida o PDF e tente novamente.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  try {
    const configuredModel = process.env.OLLAMA_MODEL?.trim() || 'gemma4:31b-cloud';
    let models = configuredModel === 'gemma4:31b-cloud'
      ? [configuredModel]
      : [configuredModel, 'gemma4:31b-cloud'];
    for (const turn of orientationTurns) {
      let renderBuffer = fileBuffer;
      if (turn !== 0) {
        const pdf = await PDFDocument.load(fileBuffer);
        for (const page of pdf.getPages()) {
          const angle = ((page.getRotation().angle + turn) % 360 + 360) % 360;
          page.setRotation(degrees(angle));
        }
        renderBuffer = Buffer.from(await pdf.save());
      }

      const parser = new PDFParse({ data: renderBuffer });
      let images: string[];
      try {
        const screenshots = await parser.getScreenshot({ scale: 1.5, imageBuffer: true, imageDataUrl: false });
        images = screenshots.pages.map(page => Buffer.from(page.data).toString('base64'));
      } finally {
        await parser.destroy();
      }
      if (!images.length) continue;

      for (let index = 0; index < models.length; index++) {
        const model = models[index];
        const response = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            stream: false,
            format: OPENAI_ROUTE_SCHEMA,
            messages: [{ role: 'user', content: `${prompt}\nOrientação enviada para esta tentativa: rotação de ${turn}° no sentido horário.`, images }]
          }),
          signal: controller.signal
        });
        const result = await response.json() as any;
        if (!response.ok) {
          const apiMessage = result?.error || `HTTP ${response.status}`;
          const retired = response.status === 410 && /retired|try gemma4:31b-cloud/i.test(apiMessage);
          if (retired && index < models.length - 1) {
            const fallbackModel = models[index + 1];
            console.warn(`[OCR] Modelo Ollama ${model} aposentado; tentando ${fallbackModel} para ${filename}.`);
            models = models.filter(candidate => candidate !== model);
            index--;
            continue;
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error(`O Ollama Cloud recusou a chave ou o acesso ao modelo. Confira OLLAMA_API_KEY, OLLAMA_MODEL e os créditos da conta. (${apiMessage})`);
          }
          if (response.status === 429) throw new Error(`Limite de uso do Ollama Cloud atingido: ${apiMessage}`);
          throw new Error(`Falha na API do Ollama Cloud (${response.status}): ${apiMessage}`);
        }
        const outputText = result?.message?.content;
        if (typeof outputText !== 'string' || !outputText.trim()) continue;
        try {
          const extracted = parseExtractionJson(outputText);
          if (typeof extracted.originCity === 'string' && extracted.originCity.trim() &&
              typeof extracted.destinationCity === 'string' && extracted.destinationCity.trim() &&
              Array.isArray(extracted.records) && extracted.records.length > 0) {
            if (turn !== 0) console.log(`[OCR] Orientação corrigida em ${turn}° para ${filename}.`);
            return outputText.trim();
          }
        } catch {
          // Try the next orientation when the model cannot read this view.
        }
        console.warn(`[OCR] Dados essenciais não identificados na rotação ${turn}° de ${filename}; tentando outra orientação.`);
        break;
      }
    }
    throw new Error('O OCR não identificou origem, destino e veículos em nenhuma orientação do PDF. Confira se a imagem está legível; nenhum valor foi importado.');
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error('A leitura do PDF pelo Ollama Cloud excedeu 5 minutos. O arquivo continua salvo; tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ExtractionResult {
  client: string;
  originCity: string;
  originState?: string;
  priorityTariffTable?: boolean;
  secondaryOriginCity?: string;
  destinationCity: string;
  destinationConfidence: number;
  destinationHintConflict: boolean;
  differential: Differential;
  pagesExtracted: number;
  records: Array<{
    vehicleType: string;
    totalValueRaw: string;
    numericValue: number | null;
    freightWeightRaw?: string | null;
    tollRaw?: string | null;
    freightWeightValue?: number | null;
    tollValue?: number | null;
    hasFreightBreakdown?: boolean;
    confidence: number;
    notes?: string;
  }>;
}

function parseExtractionJson(responseText: string): any {
  const withoutFence = responseText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    // Some models add a short explanation around the JSON despite structured
    // output mode. Extract the first complete top-level object safely.
    const start = withoutFence.indexOf('{');
    if (start < 0) throw new Error('O modelo não retornou um objeto JSON válido.');
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < withoutFence.length; i++) {
      const char = withoutFence[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return JSON.parse(withoutFence.slice(start, i + 1));
    }
    throw new Error('O modelo retornou JSON incompleto ou inválido. Tente novamente.');
  }
}

// Parse Brazilian currency into integer cents so financial calculations never
// depend on binary floating-point rounding.
function currencyToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
  if (!raw || raw === '-') return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function centsToNumber(cents: number | null): number | null {
  return cents === null ? null : cents / 100;
}

function normalizedVehicleRule(type: string): 'TOCO' | 'MEDIO' | 'VUC' | null {
  const vehicle = type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/\bTOCO\b/.test(vehicle)) return 'TOCO';
  if (/\bVUC\b/.test(vehicle)) return 'VUC';
  if (/\bMEDIO\b|\b3\s*\/\s*4\b/.test(vehicle)) return 'MEDIO';
  return null;
}

function getDestinationHintFromFilename(filename: string): string | undefined {
  const stem = repairUtf8Mojibake(filename).replace(/\.pdf$/i, '').trim();
  const parts = stem.split(/\s+x\s+|_x_|-x-/i);
  if (parts.length < 2) return undefined;
  const candidate = parts[parts.length - 1]
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toUpperCase();
  return candidate.length >= 3 ? candidate : undefined;
}

function normalizeCityIdentity(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(?:DE|DO|DA|DOS|DAS)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatCurrencyBRL(value: number | null): string {
  if (value === null || isNaN(value) || value <= 0) return '-';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseCurrencyInput(input: string | number | null | undefined): { formatted: string; numeric: number | null } {
  if (!input) return { formatted: '-', numeric: null };
  if (typeof input === 'number') {
    return { formatted: formatCurrencyBRL(input), numeric: input };
  }
  const clean = input.trim();
  if (clean === '-' || clean === '' || clean.toLowerCase() === 'null') {
    return { formatted: '-', numeric: null };
  }
  const normalized = clean.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(normalized);
  if (isNaN(num)) {
    return { formatted: clean, numeric: null };
  }
  return { formatted: formatCurrencyBRL(num), numeric: num };
}

import { getKnownCityCodesMap } from './defaultMeliBases.ts';

const KNOWN_CITY_CODES_MAP = getKnownCityCodesMap();
const BRAZIL_UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);

/**
 * Ensure city is properly registered in db.cities with valid codes
 */
export function ensureCityRegistered(cityName: string, defaultCode?: string): City {
  const norm = cityName.toUpperCase().trim() || 'CIDADE';
  
  // 1. Direct match by name
  let city = db.getCityByName(norm);

  // 2. Check if norm is actually a known code (e.g. "BRSP01", "SSP1")
  if (!city && KNOWN_CITY_CODES_MAP[norm]) {
    const known = KNOWN_CITY_CODES_MAP[norm];
    city = db.getCityByName(known.city);
  }

  // 3. Check if defaultCode is a known code
  if (!city && defaultCode && KNOWN_CITY_CODES_MAP[defaultCode.toUpperCase().trim()]) {
    const known = KNOWN_CITY_CODES_MAP[defaultCode.toUpperCase().trim()];
    city = db.getCityByName(known.city);
  }

  // 4. Fuzzy match in db cities (e.g., "CAJAMAR" matching "CAJAMAR (I)")
  if (!city) {
    const allCities = db.getCities();
    city = allCities.find(c => {
      const cName = c.name.toUpperCase();
      return cName === norm || cName.startsWith(norm) || norm.startsWith(cName);
    });
  }

  // 5. If still not found, create new city
  if (!city) {
    const cleanPrefix = norm.replace(/[^A-Z]/g, '').substring(0, 4) || 'COD';
    city = db.addCity({
      name: norm,
      state: 'BR',
      codes: [defaultCode || `COD-${cleanPrefix}`],
      active: true
    });
  }

  return city;
}

/**
 * Process document with the free local PaddleOCR text-recognition pipeline.
 */
export async function processDocumentWithOCR(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  documentId: string
): Promise<RouteRecord[]> {
  let extracted: ExtractionResult;
  try {
      const engine = db.getSettings().ocrEngine || 'paddle';
      const engineLabel = engine === 'rapidocr' ? 'RapidOCR' : 'PaddleOCR';
      const extractLocally = engine === 'rapidocr' ? extractWithRapidOCR : extractWithPaddleOCR;
      console.log(`[OCR] Calling free local ${engineLabel} for document ${filename}...`);
      const destinationHint = getDestinationHintFromFilename(filename);
      /* const prompt = `
Você é um especialista em OCR e leitura de formulários logísticos da Monfredini Transportes / Mercado Livre.
Analise detalhadamente o documento anexado (pode conter escrita manuscrita, tabelas e anotações manuais).
ATENÇÃO À ORIENTAÇÃO: a página pode estar girada 90°, 180° ou 270°, ou conter uma folha horizontal digitalizada em página vertical. Reoriente mentalmente a imagem até que os textos e cabeçalhos fiquem legíveis antes de identificar origem, destino e valores. Leia as células pela posição dos rótulos, não pela orientação física da imagem.

REGRAS DE EXTRAÇÃO:
1. CLIENTE: Identifique o cliente na parte superior (ex: "Mercado Livre").
2. CIDADE ORIGEM: Identifique a cidade de origem (ex: RIO DE JANEIRO, QUEIMADOS, LIMEIRA, etc.). Escreva em maiúsculas.
   - Identifique também a UF da ORIGEM somente se estiver escrita ou claramente identificável no documento. Não deduza SP pelo nome do arquivo nem por padrão; se ausente/duvidosa, retorne originState vazio.
   - Se houver duas origens separadas por "ou", retorne a segunda em secondaryOriginCity.
3. CIDADE DESTINO: Identifique a cidade de destino (ex: CAMPINAS, GUARULHOS, SÃO JOÃO DE MERITI, EXTREMA, etc.). Escreva em maiúsculas.
   - O nome do arquivo sugere o destino "${destinationHint || 'não informado'}". Use-o como pista secundária quando o campo DESTINO estiver ilegível, vazio ou mostrar apenas um código. Se o documento mostrar claramente outra cidade, priorize o documento e sinalize baixa confiança.
   - Informe destinationConfidence (0 a 100) conforme a leitura do campo de destino, sem usar a confiança dos valores das tarifas.
4. DIFERENCIAL: Verifique se há indicação de "CPL", "CIRCUITO", "NORMAL" ou se está vazio ("-").
5. ITENS / PERFIS DE VEÍCULOS E VALORES (LEIA A IMAGEM, NÃO USE VALORES PADRÃO OU DE OUTROS DOCUMENTOS):
   - Marque priorityTariffTable=true se a folha tiver uma tabela superior com linhas FRETE P. e PEDÁGIO e colunas de veículos, ainda que também exista uma tabela inferior.
   - Há duas áreas independentes: a tabela superior tem FRETE P. e PEDÁGIO; a inferior tem perfis de veículos e a coluna TOTAL. Nunca descarte uma área por existir a outra.
   - Para TOCO, MÉDIO / 3/4 e VUC na tabela SUPERIOR, crie um registro de perfil CASA com o nome exato TOCO CASA, MÉDIO (3/4 - CASA) ou VUC CASA. Use FRETE P. em freightWeightRaw e PEDÁGIO em tollRaw; defina hasFreightBreakdown=true e totalValueRaw="-". Leia cada coluna pela interseção da linha e da coluna.
   - Na tabela INFERIOR, leia separadamente as linhas TOCO 3º, MÉDIO / 3/4 - 3º e VUC 3º. Crie um registro para cada linha com esse perfil 3º e use o valor manuscrito da coluna TOTAL em totalValueRaw/numericValue; defina hasFreightBreakdown=false e freightWeightRaw/tollRaw=null. Não ignore esses valores porque também existem tarifas na tabela superior.
   - Os registros CASA da tabela superior e os registros 3º da tabela inferior são distintos e devem ser retornados juntos. Se algum valor estiver ilegível, use null ou "-" para aquele campo e explique em notes; não copie valores entre áreas.
   - Para os demais veículos, use os perfis e valores totais da tabela inferior, sem inventar parcelas de frete/pedágio.
   - Quando houver as linhas FRETE P. e PEDÁGIO, o valor da linha FRETE P. vai EXCLUSIVAMENTE em freightWeightRaw; o da linha PEDÁGIO vai EXCLUSIVAMENTE em tollRaw. Não coloque a soma nem uma tarifa fixa em totalValueRaw: use "-" nesse formato.
   - Para documentos em que cada veículo está em uma linha e há uma coluna TOTAL, use o valor daquela linha em totalValueRaw/numericValue e defina hasFreightBreakdown=false; freightWeightRaw/tollRaw devem ser null.
   - Transcreva números exatamente como aparecem, no formato brasileiro (ex.: "1.947,50"). Se uma célula estiver ilegível, retorne null para aquela célula e explique em notes; nunca complete, estime, reutilize valores já cadastrados ou invente tarifas.
   - A RECEBER é frete peso + pedágio. PAGAMENTO MOTORISTA é A RECEBER × 0,90 se origem SP, ou × 0,80 se origem de outro estado. Só aplique para perfis CASA de TOCO, MÉDIO/3/4 ou VUC e somente se a UF de origem estiver confirmada. Perfis 3º usam diretamente o TOTAL da tabela inferior e não recebem esse cálculo.
   - Valores de frete, pedágio, A RECEBER e pagamento devem ser tratados em centavos; arredondamento de meio centavo para cima.
   - Preserve a descrição original do perfil do veículo. Use TOCO CASA, MÉDIO (3/4 - CASA), VUC CASA para as colunas correspondentes da tabela superior, e TOCO 3º, MÉDIO (3/4 - 3º), VUC 3º para as linhas correspondentes da tabela inferior.
   - Se a linha não tiver valor manuscrito, use "-".
   - Informe confidence como porcentagem de 0 a 100 (100 = leitura muito segura; 0 = ilegível).
`; */

      let parsed: any;
      try {
        const responseText = JSON.stringify(await extractLocally(fileBuffer, filename));
        if (!responseText) throw new Error('O serviço de OCR não retornou dados para este PDF.');
        parsed = parseExtractionJson(responseText);
      } catch (primaryError) {
        const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
        // Paddle can return a successful but wrongly oriented page that does
        // not yield route endpoints. RapidOCR checks all four rotations, so
        // give it a chance before failing the reprocess operation.
        if (engine !== 'paddle' || !/não identificou origem e destino com segurança|não encontrou valores de veículos legíveis/i.test(message)) {
          throw primaryError;
        }
        console.warn(`[OCR] PaddleOCR não identificou a rota em ${filename}; tentando RapidOCR com correção de orientação.`);
        parsed = await extractWithRapidOCR(fileBuffer, filename);
      }
      // Handwritten tariff totals can be legible to RapidOCR when PaddleOCR
      // returns an empty or implausibly small value. Use the other local engine
      // only for incomplete Paddle reads, then merge only independently read
      // values; never replace a valid primary-engine amount with a guess.
      if (engine === 'paddle' && parsed.priorityTariffTable === true && Array.isArray(parsed.records)) {
        const hasUnreadableTotal = parsed.records.some((record: any) => {
          if (record?.hasFreightBreakdown === true) return false;
          const raw = typeof record?.totalValueRaw === 'string' ? record.totalValueRaw : '-';
          const value = typeof record?.numericValue === 'number' ? record.numericValue : parseCurrencyInput(raw).numeric;
          return value === null || value < 100;
        });
        if (hasUnreadableTotal) {
          try {
            const secondary = await extractWithRapidOCR(fileBuffer, filename);
            const recordKey = (record: any) => String(record?.vehicleType || '')
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
            const secondaryByType = new Map<string, any>(
              (Array.isArray(secondary.records) ? secondary.records : []).map((record: any) => [recordKey(record), record])
            );
            const primaryRecords = parsed.records as any[];
            const primaryTypes = new Set(primaryRecords.map(recordKey));
            parsed.records = primaryRecords.map(record => {
              const alternate = secondaryByType.get(recordKey(record));
              if (!alternate) return record;
              const primaryValue = typeof record.numericValue === 'number'
                ? record.numericValue
                : parseCurrencyInput(record.totalValueRaw).numeric;
              const alternateRaw = typeof alternate.totalValueRaw === 'string' ? alternate.totalValueRaw : '-';
              const alternateValue = typeof alternate.numericValue === 'number'
                ? alternate.numericValue
                : parseCurrencyInput(alternateRaw).numeric;
              const improvesTotal = record.hasFreightBreakdown !== true
                && (primaryValue === null || primaryValue < 100)
                && alternateValue !== null && alternateValue >= 100;
              const merged = { ...record };
              if (improvesTotal) {
                merged.totalValueRaw = alternateRaw;
                merged.numericValue = alternateValue;
                merged.confidence = Math.max(Number(record.confidence) || 0, Number(alternate.confidence) || 0);
                merged.notes = undefined;
              }
              for (const field of ['freightWeightRaw', 'tollRaw'] as const) {
                if (!merged[field] && typeof alternate[field] === 'string' && alternate[field].trim()) {
                  merged[field] = alternate[field];
                }
              }
              return merged;
            });
            for (const alternate of Array.isArray(secondary.records) ? secondary.records : []) {
              const raw = typeof alternate.totalValueRaw === 'string' ? alternate.totalValueRaw : '-';
              const value = typeof alternate.numericValue === 'number' ? alternate.numericValue : parseCurrencyInput(raw).numeric;
              const hasBreakdown = alternate.hasFreightBreakdown === true
                && (Boolean(alternate.freightWeightRaw) || Boolean(alternate.tollRaw));
              if (!primaryTypes.has(recordKey(alternate)) && (hasBreakdown || (value !== null && value >= 100))) {
                parsed.records.push(alternate);
              }
            }
          } catch (fallbackError) {
            console.warn('[OCR] RapidOCR não conseguiu complementar valores manuscritos do PaddleOCR:', fallbackError);
          }
        }
      }
      const originCity = typeof parsed.originCity === 'string' ? parsed.originCity.trim().toUpperCase() : '';
      const originState = typeof parsed.originState === 'string' ? parsed.originState.trim().toUpperCase() : '';
      const destinationCity = typeof parsed.destinationCity === 'string' ? parsed.destinationCity.trim().toUpperCase() : '';
      const destinationConfidence = typeof parsed.destinationConfidence === 'number' && Number.isFinite(parsed.destinationConfidence)
        ? Math.round(Math.max(0, Math.min(100, parsed.destinationConfidence)))
        : 0;
      const normalizedDestinationHint = destinationHint ? normalizeCityIdentity(destinationHint) : undefined;
      const normalizedDestinationCity = normalizeCityIdentity(destinationCity);
      // The filename may contain only the municipality while the printed unit
      // code resolves to a more specific registered base, e.g. CONTAGEM
      // (GOLIVE / XPEX). These are consistent hints, not a destination conflict.
      const destinationMatchesMunicipality = Boolean(normalizedDestinationHint && (
        normalizedDestinationCity === normalizedDestinationHint
        || normalizedDestinationCity.startsWith(`${normalizedDestinationHint} `)
      ));
      const destinationHintConflict = Boolean(destinationHint && !destinationMatchesMunicipality);
      const records = Array.isArray(parsed.records) ? parsed.records : [];
      if (!originCity || !destinationCity || records.length === 0) {
        const missing = [
          !originCity ? 'origem' : '',
          !destinationCity ? 'destino' : '',
          records.length === 0 ? 'valores dos veículos' : ''
        ].filter(Boolean).join(', ');
        throw new Error(`O OCR não identificou ${missing} neste PDF. A página pode estar girada ou ilegível. Confira a orientação e tente novamente; nenhum valor foi importado.`);
      }
      const mappedRecords: ExtractionResult['records'] = records.map((record: any) => {
        const rawValue = typeof record.totalValueRaw === 'string' ? record.totalValueRaw.trim() : '-';
        const parsedValue = parseCurrencyInput(rawValue);
        const numericValue = typeof record.numericValue === 'number' && Number.isFinite(record.numericValue)
          ? record.numericValue
          : parsedValue.numeric;
        const freightWeightRaw = typeof record.freightWeightRaw === 'string' ? record.freightWeightRaw.trim() : null;
        const tollRaw = typeof record.tollRaw === 'string' ? record.tollRaw.trim() : null;
        return {
          vehicleType: typeof record.vehicleType === 'string' ? record.vehicleType.trim() : '',
          totalValueRaw: rawValue,
          numericValue,
          freightWeightRaw,
          tollRaw,
          freightWeightValue: centsToNumber(currencyToCents(freightWeightRaw)),
          tollValue: centsToNumber(currencyToCents(tollRaw)),
          hasFreightBreakdown: record.hasFreightBreakdown === true || freightWeightRaw !== null || tollRaw !== null,
          confidence: typeof record.confidence === 'number' && Number.isFinite(record.confidence)
            ? Math.round(Math.max(0, Math.min(100, record.confidence <= 1 ? record.confidence * 100 : record.confidence)))
            : 0,
          notes: typeof record.notes === 'string' ? record.notes : undefined
        };
      }).filter((record: ExtractionResult['records'][number]) => {
        if (!record.vehicleType) return false;
        // OCR occasionally mistakes a stray handwritten/table digit for a
        // complete vehicle TOTAL (for example, "4" -> R$ 4,00). Freight and
        // toll breakdowns are stored in their own fields, so a tiny parsed
        // total is never a valid tariff and should not become a duplicate row.
        if (record.numericValue !== null && record.numericValue < 100) {
          console.warn(`[OCR] Ignorando total implausível de R$ ${record.numericValue.toFixed(2)} para ${record.vehicleType}.`);
          return false;
        }
        return true;
      });
      // The standard fare sheet always pairs BITREM with BITREM 3º. If OCR
      // misses the first label (or rejects a stray digit from its TOTAL cell),
      // retain the profile for manual review with an empty value.
      if (mappedRecords.some(record => /^BITREM\s*3/i.test(record.vehicleType))
          && !mappedRecords.some(record => /^BITREM$/i.test(record.vehicleType.trim()))) {
        mappedRecords.push({
          vehicleType: 'BITREM',
          totalValueRaw: '-',
          numericValue: null,
          freightWeightRaw: null,
          tollRaw: null,
          freightWeightValue: null,
          tollValue: null,
          hasFreightBreakdown: false,
          confidence: 0,
          notes: 'Perfil BITREM incluído para conferência; o OCR não reconheceu um valor seguro na linha.'
        });
      }
      const priorityTariffTable = parsed.priorityTariffTable === true;
      let normalizedRecords = mappedRecords;
      if (priorityTariffTable) {
        const priorityTypes = new Set(['TOCO', 'MEDIO', 'VUC']);
        const groupedPriority = new Map<string, ExtractionResult['records'][number][]>();
        const otherRecords = mappedRecords.filter(record => !priorityTypes.has(normalizedVehicleRule(record.vehicleType) || ''));
        for (const record of mappedRecords) {
          const rule = normalizedVehicleRule(record.vehicleType);
          if (!rule || !priorityTypes.has(rule)) continue;
          const group = groupedPriority.get(rule) || [];
          group.push(record);
          groupedPriority.set(rule, group);
        }
        const thirdProfilePattern = /3\s*(?:º|°|o)|TERCEIRO/i;
        const casaPriority = [...groupedPriority.entries()].map(([rule, group]) => {
          const topTableRecord = group.find(record => !thirdProfilePattern.test(record.vehicleType) && record.hasFreightBreakdown)
            || group.find(record => !thirdProfilePattern.test(record.vehicleType));
          const vehicleType = rule === 'TOCO' ? 'TOCO CASA' : rule === 'MEDIO' ? 'MÉDIO (3/4 - CASA)' : 'VUC CASA';
          if (!topTableRecord || !topTableRecord.hasFreightBreakdown) {
            return {
              ...(topTableRecord || {}),
              vehicleType,
              totalValueRaw: '-',
              numericValue: null,
              freightWeightRaw: null,
              tollRaw: null,
              freightWeightValue: null,
              tollValue: null,
              hasFreightBreakdown: true,
              confidence: topTableRecord?.confidence ?? 0,
              notes: `Tarifa superior de ${rule} não identificada; valor da linha 3º não foi usado como substituto.`
            };
          }
          return { ...topTableRecord, vehicleType, totalValueRaw: '-', numericValue: null, hasFreightBreakdown: true };
        });
        const thirdRecords = mappedRecords
          .filter(record => priorityTypes.has(normalizedVehicleRule(record.vehicleType) || '') && thirdProfilePattern.test(record.vehicleType))
          .map(record => {
            const rule = normalizedVehicleRule(record.vehicleType)!;
            return {
              ...record,
              vehicleType: rule === 'TOCO' ? 'TOCO 3º' : rule === 'MEDIO' ? 'MÉDIO (3/4 - 3º)' : 'VUC 3º',
              freightWeightRaw: null,
              tollRaw: null,
              freightWeightValue: null,
              tollValue: null,
              hasFreightBreakdown: false
            };
          });
        normalizedRecords = [...otherRecords, ...casaPriority, ...thirdRecords];
      }

      extracted = {
        client: typeof parsed.client === 'string' && parsed.client.trim() ? parsed.client.trim() : db.getSettings().defaultClient,
        originCity,
        originState: BRAZIL_UFS.has(originState) ? originState : undefined,
        priorityTariffTable,
        secondaryOriginCity: typeof parsed.secondaryOriginCity === 'string' && parsed.secondaryOriginCity.trim()
          ? parsed.secondaryOriginCity.trim().toUpperCase()
          : undefined,
        destinationCity,
        destinationConfidence: destinationHintConflict ? Math.min(destinationConfidence, 40) : destinationConfidence,
        destinationHintConflict,
        differential: ['NORMAL', 'CPL', 'CIRCUITO', '-'].includes(parsed.differential) ? parsed.differential as Differential : '-',
        pagesExtracted: 1,
        records: normalizedRecords
      };
      if (extracted.records.length === 0) {
        throw new Error('O PDF não contém perfis de veículos legíveis. Nenhum valor foi importado.');
      }
  } catch (apiErr) {
      console.error(`[OCR] Failed to extract ${filename}:`, apiErr);
      throw new Error(apiErr instanceof Error ? apiErr.message : 'Falha ao ler o PDF com OCR. Nenhum valor foi importado.');
  }

  // Expand codes and store in database
  return expandAndSaveRoutes(extracted, documentId, filename);
}

// Backward-compatible export for any integrations still importing this symbol.
export const processDocumentWithPaddleOCR = processDocumentWithOCR;

/**
 * Expands destination codes and generates RouteRecord rows
 */
export function expandAndSaveRoutes(
  extracted: ExtractionResult,
  documentId: string,
  filename: string
): RouteRecord[] {
  const originList = [extracted.originCity];
  if (extracted.secondaryOriginCity && extracted.secondaryOriginCity !== extracted.originCity) {
    originList.push(extracted.secondaryOriginCity);
  }

  const allGeneratedRecords: RouteRecord[] = [];
  const settings = db.getSettings();
  const now = new Date().toISOString();
  const seenExtractedRecords = new Set<string>();
  const uniqueExtractedRecords = extracted.records.filter(record => {
    const duplicateKey = JSON.stringify([
      record.vehicleType.trim().toUpperCase(),
      record.totalValueRaw?.trim(),
      record.numericValue ?? null,
      record.freightWeightRaw?.trim(),
      record.tollRaw?.trim(),
      record.hasFreightBreakdown === true
    ]);
    if (seenExtractedRecords.has(duplicateKey)) return false;
    seenExtractedRecords.add(duplicateKey);
    return true;
  });
  if (uniqueExtractedRecords.length !== extracted.records.length) {
    console.warn(`[OCR] Removendo ${extracted.records.length - uniqueExtractedRecords.length} linha(s) duplicada(s) extraída(s) de ${filename}.`);
  }

  // For each origin city in the document
  for (const originCityName of originList) {
    const originCity = ensureCityRegistered(originCityName);
    const originCode = originCity.codes.filter(c => c.active).map(c => c.code).join('/') || 'SRJ1';
    const explicitStateForThisOrigin = originCityName === extracted.originCity ? extracted.originState : undefined;
    const registeredState = originCity.state.toUpperCase();
    const originState = explicitStateForThisOrigin || (BRAZIL_UFS.has(registeredState) ? registeredState : undefined);

    const destCity = ensureCityRegistered(extracted.destinationCity);
    const destinationCode = destCity.codes.filter(c => c.active).map(c => c.code).join('/') || `COD-${destCity.name.substring(0, 3)}`;

    // Keep every active city code in one route record, separated by slashes.
    {
      for (const rec of uniqueExtractedRecords) {
        const { numeric: standardNumeric } = parseCurrencyInput(
          rec.numericValue !== null && rec.numericValue !== undefined ? rec.numericValue : rec.totalValueRaw
        );
        const hasFreightBreakdown = rec.hasFreightBreakdown === true || rec.freightWeightRaw != null || rec.tollRaw != null || rec.freightWeightValue != null || rec.tollValue != null;
        const freightWeightCents = currencyToCents(rec.freightWeightRaw ?? rec.freightWeightValue);
        const tollCents = currencyToCents(rec.tollRaw ?? rec.tollValue);
        const receivableCents = hasFreightBreakdown && freightWeightCents !== null && tollCents !== null
          ? freightWeightCents + tollCents
          : null;
        const isThirdProfile = /3\s*(?:º|°|o)|TERCEIRO/i.test(rec.vehicleType);
        const vehicleRule = isThirdProfile ? null : normalizedVehicleRule(rec.vehicleType);
        const percent: 10 | 20 | undefined = originState
          ? (originState === 'SP' ? 10 : 20)
          : undefined;
        // Integer-cent half-up rounding: (amount * rate + half denominator) / denominator.
        const driverPaymentCents = receivableCents !== null && vehicleRule && percent !== undefined
          ? Math.floor((receivableCents * (100 - percent) + 50) / 100)
          : null;
        const displayCents = hasFreightBreakdown
          ? driverPaymentCents
          : currencyToCents(standardNumeric ?? rec.totalValueRaw);
        const numeric = centsToNumber(displayCents);
        const formatted = numeric === null
          ? '-'
          : `R$ ${(Math.floor(displayCents! / 100)).toLocaleString('pt-BR')},${String(displayCents! % 100).padStart(2, '0')}`;
        const calculationNote = hasFreightBreakdown
          ? receivableCents === null
            ? 'Frete peso ou pedágio ilegível; cálculo não realizado. Conferir os valores antes de aprovar.'
            : !vehicleRule
              ? 'Regra não definida para este veículo.'
              : percent === undefined
                ? 'UF da origem não identificada; confirme a origem para calcular o pagamento do motorista.'
                : undefined
          : undefined;
        const calculationNeedsReview = hasFreightBreakdown && (
          receivableCents === null || !vehicleRule || percent === undefined
        );
        const destinationNeedsReview = extracted.destinationHintConflict || extracted.destinationConfidence < 50;

        const routeRecord: RouteRecord = {
          id: `rec-${crypto.randomBytes(8).toString('hex')}`,
          documentId,
          documentPageId: `page-doc-${documentId}-1`,
          documentName: filename,
          pageNumber: 1,
          client: extracted.client || 'Mercado Livre',
          originCity: originCity.name,
          originState,
          originCode,
          destinationCity: destCity.name,
          destinationCode,
          vehicleType: rec.vehicleType,
          totalValue: formatted,
          numericValue: numeric,
          freightWeightValue: centsToNumber(freightWeightCents),
          tollValue: centsToNumber(tollCents),
          hasFreightBreakdown,
          receivableValue: centsToNumber(receivableCents),
          driverPaymentValue: centsToNumber(driverPaymentCents),
          driverPaymentPercent: percent && receivableCents !== null && vehicleRule ? percent : undefined,
          differential: extracted.differential,
          ocrConfidence: Math.min(
            Math.round(rec.confidence ?? 0),
            extracted.destinationConfidence,
            extracted.destinationHintConflict ? 40 : 100
          ),
          reviewStatus: settings.autoConfirmOcr && !calculationNeedsReview && !destinationNeedsReview
            ? 'REVISADO'
            : 'AGUARDANDO CONFERÊNCIA',
          notes: [
            rec.notes,
            calculationNote,
            extracted.destinationHintConflict
              ? `Destino lido como ${extracted.destinationCity}, mas o nome do arquivo sugere ${getDestinationHintFromFilename(filename)}. Conferir antes de aprovar.`
              : undefined
          ].filter(Boolean).join(' ') || undefined,
          createdAt: now,
          updatedAt: now
        };

        allGeneratedRecords.push(routeRecord);
      }
    }
  }

  // Persist records
  db.addRouteRecords(allGeneratedRecords);

  return allGeneratedRecords;
}
