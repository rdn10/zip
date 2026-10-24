import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.ts';
import type { Differential } from './types.ts';

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'paddle_ocr_worker.py');
const python312 = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
let paddleWorker: ChildProcessWithoutNullStreams | null = null;
let paddleWorkerReady: Promise<ChildProcessWithoutNullStreams> | null = null;
let paddleWorkerError = '';
const pendingRequests = new Map<string, { resolve: (value: { pages: PaddlePage[] }) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

export interface PaddlePage {
  page: number;
  markdown: string;
  rows?: Array<{ y?: number; cells: Array<{ text: string; x: number; score?: number }> }>;
  alternateItems?: Array<{ text: string; x: number; y: number; score?: number }>;
}

export interface OcrDocumentContext {
  filename: string;
  originHint?: string;
  destinationHint?: string;
  cityCandidates: Array<{ name: string; state: string; codes: string[] }>;
}

/** Shared PDF identification context sent to the local OCR workers. */
export function buildOcrDocumentContext(filename: string): OcrDocumentContext {
  const parts = filename.replace(/\.pdf$/i, '').split(/\s+x\s+|_x_|-x-/i)
    .map(part => part.replace(/[_-]+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
  const cityCandidates = db.getCities().map(city => ({
    name: city.name,
    state: city.state,
    codes: city.codes.filter(code => code.active).map(code => code.code)
  }));
  return {
    filename,
    originHint: parts[0],
    destinationHint: parts.length > 1 ? parts[parts.length - 1] : undefined,
    cityCandidates
  };
}

function getPaddleWorker(): Promise<ChildProcessWithoutNullStreams> {
  if (paddleWorker && !paddleWorker.killed && paddleWorkerReady) return paddleWorkerReady;
  const python = process.env.PADDLEOCR_PYTHON || python312;
  const child = spawn(python, [workerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PADDLEOCR_DEVICE: process.env.PADDLEOCR_DEVICE || 'auto',
      // Two CPU threads keep local OCR responsive on laptops while still
      // allowing the worker to make progress. Can be tuned by the user.
      PADDLEOCR_CPU_THREADS: process.env.PADDLEOCR_CPU_THREADS || '2'
    }
  });
  console.info(`[PaddleOCR] Worker Python iniciado (${path.basename(python)}). Aguardando carregamento dos modelos.`);
  paddleWorker = child;
  paddleWorkerError = '';
  paddleWorkerReady = new Promise((resolve, reject) => {
    const startupTimeout = Number(process.env.PADDLEOCR_STARTUP_TIMEOUT_MS) || 300_000;
    const startupTimer = setTimeout(() => {
      const error = new Error(
        `O PaddleOCR não iniciou em ${Math.round(startupTimeout / 1000)} segundos. Confira Python, dependências e download dos modelos.`
      );
      if (paddleWorker === child) {
        paddleWorker = null;
        paddleWorkerReady = null;
      }
      child.kill();
      reject(error);
    }, startupTimeout);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      try {
        const message = JSON.parse(line);
        if (message.ready) {
          clearTimeout(startupTimer);
          console.info('[PaddleOCR] Worker pronto para ler documentos.');
          resolve(child);
          return;
        }
        const pending = pendingRequests.get(String(message.id));
        if (!pending) return;
        clearTimeout(pending.timer);
        pendingRequests.delete(String(message.id));
        if (message.error) pending.reject(new Error(String(message.error)));
        else pending.resolve(message.result as { pages: PaddlePage[] });
      } catch (error) {
        console.warn('[PaddleOCR] Ignorando linha não JSON do worker:', error instanceof Error ? error.message : String(error));
      }
    });
    child.stderr.on('data', chunk => {
      const output = String(chunk);
      paddleWorkerError = `${paddleWorkerError}${output}`.slice(-4000);
      for (const line of output.split(/\r?\n/)) {
        if (/\[PaddleOCR\]/i.test(line)) console.info(line.trim());
      }
    });
    child.on('error', error => {
      clearTimeout(startupTimer);
      reject(error);
      for (const pending of pendingRequests.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      pendingRequests.clear();
      paddleWorker = null;
      paddleWorkerReady = null;
    });
    child.on('exit', code => {
      clearTimeout(startupTimer);
      const error = new Error(`O worker PaddleOCR encerrou (código ${code}). ${paddleWorkerError}`);
      reject(error);
      for (const pending of pendingRequests.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      pendingRequests.clear();
      paddleWorker = null;
      paddleWorkerReady = null;
    });
  });
  return paddleWorkerReady;
}

async function requestPaddleDocument(pdfPath: string, context: OcrDocumentContext): Promise<{ pages: PaddlePage[] }> {
  const child = await getPaddleWorker();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  console.info(`[PaddleOCR] Enviando PDF ao worker: ${path.basename(pdfPath)}.`);
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(process.env.PADDLEOCR_TIMEOUT_MS) || 900_000;
    const timer = setTimeout(() => {
      if (!pendingRequests.has(id)) return;
      const pending = pendingRequests.get(id)!;
      pendingRequests.delete(id);
      pending.reject(new Error('O PaddleOCR excedeu o limite de 15 minutos. O worker foi reiniciado; tente novamente.'));
      // Do not leave a timed-out inference occupying the single worker and
      // causing every later PDF to wait behind it indefinitely.
      if (paddleWorker === child) {
        paddleWorker = null;
        paddleWorkerReady = null;
        child.kill();
      }
    }, timeoutMs);
    timer.unref?.();
    pendingRequests.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, path: pdfPath, context })}\n`, error => {
      if (!error) return;
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(error);
    });
  });
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function splitTables(markdown: string): string[][][] {
  const htmlRows = Array.from(markdown.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis));
  if (htmlRows.length) {
    return [htmlRows.map(([, row]) => Array.from(row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis), ([, cell]) =>
      cell.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
    ))];
  }
  const tables: string[][][] = [];
  let current: string[][] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) {
      if (current.length) tables.push(current);
      current = [];
      continue;
    }
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.replace(/[*`]/g, '').trim());
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) continue;
    current.push(cells);
  }
  if (current.length) tables.push(current);
  return tables;
}

function moneyIn(text: string): string | null {
  const matches = text.match(/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?/g)?.filter(value => /\d/.test(value));
  if (!matches?.length) return null;
  const raw = matches[matches.length - 1].replace(/R\$\s*/i, '').trim().replace(/\s/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.includes('.') && !/^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw
      : raw.replace(/\./g, '');
  const amount = Number(normalized);
  const compactDigits = raw.replace(/\D/g, '');
  // Handwritten 8.000 is occasionally returned by the recognizer as 0008.
  // Treat this reversed leading-zero pattern as 8.000 rather than dropping it
  // later as an implausibly small tariff.
  const correctedAmount = amount < 100 && /^000[1-9]$/.test(compactDigits)
    ? Number(compactDigits.split('').reverse().join(''))
    : amount;
  // A high OCR confidence is not available in this local text pipeline. Reject
  // implausibly large freight values rather than importing concatenated digits.
  if (!Number.isFinite(correctedAmount) || correctedAmount <= 0 || correctedAmount > 100_000) return null;
  return correctedAmount.toFixed(2).replace('.', ',');
}

function moneyValuesInCells(cells: string[]): string[] {
  const values: string[] = [];
  for (const cell of cells) {
    const tokens = cell.match(/(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?/g) || [];
    for (const token of tokens) {
      const value = moneyIn(token);
      if (value && Number(value.replace(',', '.')) >= 100) values.push(value);
    }
  }
  return values;
}

function cityNearLabel(text: string, label: string): string | undefined {
  const normalizedText = normalize(text);
  const labelPosition = normalizedText.indexOf(label);
  if (labelPosition < 0) return undefined;
  const nearby = normalizedText.slice(labelPosition + label.length, labelPosition + label.length + 180);
  const cities = db.getCities().slice().sort((a, b) => b.name.length - a.name.length);
  return cities.find(city => nearby.includes(normalize(city.name)))?.name;
}

export function parsePaddleMarkdown(pages: PaddlePage[], filename: string) {
  const markdown = pages.map(page => page.markdown).join('\n');
  const geometryRows = pages.flatMap(page => {
    const rows = page.rows || [];
    let pageTotalMinX: number | null = null;
    for (const row of rows) {
      const totalCell = row.cells.find(cell => normalize(cell.text).includes('TOTAL'));
      const tollCell = row.cells.find(cell => /PED.{0,2}GIO/.test(normalize(cell.text)));
      if (totalCell && tollCell && totalCell.x > tollCell.x) {
        pageTotalMinX = (totalCell.x + tollCell.x) / 2;
        break;
      }
    }
    return rows.map(row => ({ ...row, totalMinX: pageTotalMinX, alternateItems: page.alternateItems || [] }));
  });
  const plainText = markdown.replace(/<[^>]*>/g, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ');
  const filenameCities = filename.replace(/\.pdf$/i, '').split(/\s+x\s+|_x_|-x-/i).map(part => part.replace(/[_-]+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim());
  const cities = db.getCities().slice().sort((a, b) => b.name.length - a.name.length);
  const originFromFilename = filenameCities[0]
    ? cities
      .filter(city => normalize(city.name) === normalize(filenameCities[0]) || normalize(city.name).startsWith(normalize(filenameCities[0])))
      .sort((a, b) => a.name.length - b.name.length)[0]
    : undefined;
  const originLabelPosition = normalize(plainText).indexOf('ORIGEM');
  const originLabelContext = originLabelPosition >= 0
    ? normalize(plainText).slice(originLabelPosition, originLabelPosition + 220)
    : '';
  // Perus is a district of São Paulo. PaddleOCR can return only the district
  // name from the handwritten "São Paulo/SP (Perus)" origin field; retain the
  // full base name when both parts are present in that field.
  const originIsPerusDistrict = originLabelContext.includes('PERUS') && originLabelContext.includes('SAO PAULO');
  const originFromText = cityNearLabel(plainText, 'ORIGEM') || cityNearLabel(plainText, 'ORIG:');
  const filenameDestination = filenameCities.at(-1);
  const destinationFromText = cityNearLabel(plainText, 'DESTINO');
  const originTextMatchesDestination = originFromText && (
    (destinationFromText && normalize(originFromText) === normalize(destinationFromText))
    || (filenameDestination && normalize(originFromText) === normalize(filenameDestination))
  );
  const originCity = originTextMatchesDestination && originFromFilename
    ? originFromFilename.name
    : originIsPerusDistrict
    ? 'SÃO PAULO (PERUS)'
    : originFromText || originFromFilename?.name;
  const exactFilenameDestination = filenameDestination
    ? cities.find(city => normalize(city.name) === normalize(filenameDestination))
    : undefined;
  // Freight filenames often use the municipality while the registered base has
  // a compound name such as "CITY / NEIGHBORING CITY" or "CITY (DISTRICT)".
  const filenameDestinationCandidates = filenameDestination
    ? cities.filter(city => normalize(city.name).split(/\s*(?:\/|\()\s*/, 1)[0].trim() === normalize(filenameDestination))
    : [];
  const destinationCity = destinationFromText
    || exactFilenameDestination?.name
    || filenameDestinationCandidates[0]?.name;
  const destinationHintAmbiguous = !destinationFromText
    && !exactFilenameDestination
    && filenameDestinationCandidates.length > 1;
  if (!originCity || !destinationCity) {
    throw new Error('O OCR local leu o documento, mas não identificou origem e destino com segurança. Confira o nome do arquivo e revise o PDF.');
  }

  const records: Array<Record<string, unknown>> = [];
  let priorityTariffTable = false;
  const profileLabels: Array<[RegExp, string]> = [
    [/\bBITREM\s*3/, 'BITREM 3º'], [/\bBITREM\b/, 'BITREM'],
    [/\bCARRETA\s*CASA\b/, 'CARRETA CASA'], [/\bTRUCK\s*CASA\b/, 'TRUCK CASA'],
    [/\bCARRETA.*(?:AGREGAD|REGAD)/, 'CARRETA AGREGADO'], [/\bCARRETA\s*3/, 'CARRETA 3º'],
    [/\bTRUCK\s*3/, 'TRUCK 3º'], [/\bTOCO\s*CASA\b/, 'TOCO CASA'], [/\bTOCO\s*3/, 'TOCO 3º'],
    [/\bMEDIO.*CASA\b/, 'MÉDIO (3/4 - CASA)'], [/\bMEDIO.*3/, 'MÉDIO (3/4 - 3º)'],
    [/\bVUC\s*CASA\b/, 'VUC CASA'], [/\bVUC\s*3/, 'VUC 3º']
  ];
  const profileFor = (label: string) => profileLabels.find(([pattern]) => pattern.test(normalize(label)))?.[1];

  let geometryRowIndex = 0;
  for (const table of splitTables(markdown)) {
    const headerIndex = table.findIndex(row => {
      const rowText = normalize(row.join(' '));
      return rowText.includes('TOCO') && rowText.includes('VUC') && (rowText.includes('MEDIO') || rowText.includes('3/4'));
    });
    if (headerIndex >= 0) {
      const header = table[headerIndex].map(normalize);
      const colIndex = (name: string) => header.findIndex(cell => cell.includes(name));
      const tocoIndex = colIndex('TOCO');
      const medioIndex = Math.max(colIndex('MEDIO'), colIndex('3/4'));
      const vucIndex = colIndex('VUC');
      const freightRow = table.find(row => /^FRETE\b/i.test(row[0] || ''));
      const tollRow = table.find(row => /PED.{0,2}GIO/i.test(normalize(row[0] || '')));
      if (freightRow && tollRow && tocoIndex >= 0 && medioIndex >= 0 && vucIndex >= 0) {
        priorityTariffTable = true;
        const freightValues = moneyValuesInCells(freightRow);
        const tollValues = moneyValuesInCells(tollRow);
        const casaColumns = [[3, tocoIndex, 'TOCO CASA'], [4, medioIndex, 'MÉDIO (3/4 - CASA)'], [5, vucIndex, 'VUC CASA']] as const;
        for (const [tariffPosition, tableColumn, vehicleType] of casaColumns) {
          // OCR engines sometimes merge several handwritten cells into one
          // detection box. When all six vehicle totals are recovered, preserve
          // their left-to-right order instead of indexing the merged cells.
          const freightWeightRaw = freightValues.length >= 6
            ? freightValues[tariffPosition]
            : moneyIn(freightRow[tableColumn] || '');
          const tollRaw = tollValues.length >= 6
            ? tollValues[tariffPosition]
            : moneyIn(tollRow[tableColumn] || '');
          records.push({ vehicleType, totalValueRaw: '-', numericValue: null, freightWeightRaw, tollRaw, hasFreightBreakdown: true, confidence: 45,
            notes: freightWeightRaw && tollRaw ? undefined : 'Valor manuscrito da tabela CASA não reconhecido com segurança; confira a imagem.' });
        }
      }
    }

    for (const row of table) {
      const geometryRow = geometryRows[geometryRowIndex++];
      const label = normalize(row[0] || '').replace(/#/g, '3');
      const vehicleType = profileFor(label);
      if (!vehicleType) continue;
      // When the TOTAL header is detected, select only numeric OCR boxes that
      // fall in that column. This excludes FRETE PESO and PEDÁGIO explicitly.
      let totalValueRaw: string | null = null;
      if (geometryRow?.totalMinX !== null && geometryRow?.totalMinX !== undefined) {
        const cutoff = geometryRow.totalMinX;
        const cleanHandwriting = (value: string) => value
          .replace(/[Ss]/g, '5')
          .replace(/[Oo]/g, '0')
          .replace(/\s+/g, '');
        const candidates: string[] = [];
        const baseFragments = (geometryRow.cells || [])
          .filter(cell => cell.x >= cutoff)
          .sort((a, b) => a.x - b.x)
          .map(cell => cell.text);
        const rowY = geometryRow.y;
        if (typeof rowY === 'number') {
          const alternateFragments = (geometryRow.alternateItems || [])
            .filter(item => item.x >= cutoff && Math.abs(item.y - rowY) <= 14 && /[\d]/.test(item.text))
            .sort((a, b) => a.x - b.x)
            .map(item => item.text);
          // Alternate fragments come from RapidOCR's focused high-resolution
          // pass, which only runs when the first pass missed too many amounts.
          if (alternateFragments.length) candidates.push(alternateFragments.join(''));
        }
        if (baseFragments.length) candidates.push(baseFragments.join(''));

        totalValueRaw = candidates
          .map(candidate => moneyIn(cleanHandwriting(candidate)))
          .find(value => value !== null && Number(value.replace(',', '.')) >= 100) || null;
      } else {
        totalValueRaw = row.slice(1).reverse().map(moneyIn).find(Boolean) || null;
      }
      records.push({
        vehicleType,
        totalValueRaw: totalValueRaw || '-',
        numericValue: null,
        freightWeightRaw: null,
        tollRaw: null,
        hasFreightBreakdown: false,
        confidence: totalValueRaw ? 45 : 0,
        notes: totalValueRaw ? undefined : 'Valor da coluna TOTAL não reconhecido com segurança; confira a folha.'
      });
    }
  }

  // These two rows are a fixed pair in the freight tables. Paddle can miss
  // the plain BITREM label while recognizing BITREM 3º; keep the base profile
  // visible for review with no guessed tariff instead of silently omitting it.
  if (records.some(record => record.vehicleType === 'BITREM 3º')
      && !records.some(record => record.vehicleType === 'BITREM')) {
    records.push({
      vehicleType: 'BITREM',
      totalValueRaw: '-',
      numericValue: null,
      freightWeightRaw: null,
      tollRaw: null,
      hasFreightBreakdown: false,
      confidence: 0,
      notes: 'Linha BITREM não foi reconhecida com segurança pelo OCR; confira o valor na folha.'
    });
  }

  if (!records.length) {
    throw new Error('O OCR local não encontrou valores de veículos legíveis nesta folha. Nenhuma tarifa foi importada; confira a imagem ou tente novamente.');
  }

  const origin = db.getCityByName(originCity);
  const normalizedText = normalize(plainText);
  const differential: Differential = normalizedText.includes('CPL') ? 'CPL' : normalizedText.includes('CIRCUITO') ? 'CIRCUITO' : 'NORMAL';
  return {
    client: /MERCADO\s+LIVRE/i.test(plainText) ? 'Mercado Livre' : db.getSettings().defaultClient,
    originCity,
    originState: originIsPerusDistrict ? 'SP' : origin?.state,
    destinationCity,
    destinationConfidence: destinationHintAmbiguous ? 35 : 45,
    destinationHintConflict: destinationHintAmbiguous,
    differential,
    priorityTariffTable,
    pagesExtracted: pages.length,
    records
  };
}

export async function extractWithPaddleOCR(fileBuffer: Buffer, filename: string) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'frete-paddle-'));
  const pdfPath = path.join(tempDirectory, filename.replace(/[^\w.-]/g, '_') || 'documento.pdf');
  await writeFile(pdfPath, fileBuffer);
  try {
    const workerResult = await requestPaddleDocument(pdfPath, buildOcrDocumentContext(filename));
    return parsePaddleMarkdown(workerResult.pages || [], filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error('Python 3.12 com PaddleOCR não encontrado. Configure PADDLEOCR_PYTHON ou instale as dependências PaddleOCR.');
    }
    if (/paddleocr não está instalado|no module named/i.test(message)) {
      throw new Error('PaddleOCR não está instalado neste Python. Instale paddlepaddle e paddleocr conforme o README.');
    }
    throw error;
  } finally {
    // Paddle's Windows PDF renderer can briefly keep its input handle open after
    // returning OCR results. Retry transient sharing violations instead of
    // turning a successful read into an EBUSY error.
    let cleanupError: unknown;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await rm(tempDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 400 });
        cleanupError = undefined;
        break;
      } catch (error) {
        cleanupError = error;
        const code = (error as NodeJS.ErrnoException)?.code;
        if (!['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(code || '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
    if (cleanupError) {
      console.warn(`[PaddleOCR] PDF temporário ainda bloqueado após tentativas de limpeza: ${pdfPath}`);
    }
  }
}
