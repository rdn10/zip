import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOcrDocumentContext, parsePaddleMarkdown, type OcrDocumentContext, type PaddlePage } from './paddleOcr.ts';

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rapid_ocr_worker.py');
const defaultPython = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
let worker: ChildProcessWithoutNullStreams | null = null;
let ready: Promise<ChildProcessWithoutNullStreams> | null = null;
let workerError = '';
const pending = new Map<string, { resolve: (value: { pages: PaddlePage[] }) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

function getWorker(): Promise<ChildProcessWithoutNullStreams> {
  if (worker && !worker.killed && ready) return ready;
  const python = process.env.RAPIDOCR_PYTHON || process.env.PADDLEOCR_PYTHON || defaultPython;
  const child = spawn(python, [workerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, RAPIDOCR_CPU_THREADS: process.env.RAPIDOCR_CPU_THREADS || process.env.PADDLEOCR_CPU_THREADS || '2' }
  });
  console.info(`[RapidOCR] Worker iniciado (${path.basename(python)}). Carregando modelos ONNX.`);
  worker = child;
  workerError = '';
  ready = new Promise((resolve, reject) => {
    const startupTimer = setTimeout(() => {
      child.kill(); worker = null; ready = null;
      reject(new Error('RapidOCR não iniciou no limite de tempo. Confira Python e dependências.'));
    }, Number(process.env.RAPIDOCR_STARTUP_TIMEOUT_MS) || 300_000);
    createInterface({ input: child.stdout }).on('line', line => {
      try {
        const message = JSON.parse(line);
        if (message.ready) { clearTimeout(startupTimer); console.info('[RapidOCR] Worker pronto.'); resolve(child); return; }
        if (message.startupError) { clearTimeout(startupTimer); reject(new Error(String(message.startupError))); return; }
        const request = pending.get(String(message.id));
        if (!request) return;
        clearTimeout(request.timer); pending.delete(String(message.id));
        if (message.error) request.reject(new Error(String(message.error)));
        else request.resolve(message.result as { pages: PaddlePage[] });
      } catch (error) { console.warn('[RapidOCR] Resposta inválida do worker:', error); }
    });
    child.stderr.on('data', chunk => {
      const output = String(chunk); workerError = `${workerError}${output}`.slice(-3000);
      for (const line of output.split(/\r?\n/)) if (line.includes('[RapidOCR]')) console.info(line.trim());
    });
    const failed = (error: Error) => {
      clearTimeout(startupTimer); reject(error);
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
      pending.clear(); worker = null; ready = null;
    };
    child.on('error', failed);
    child.on('exit', code => failed(new Error(`Worker RapidOCR encerrou (${code}). ${workerError}`)));
  });
  return ready;
}

async function requestDocument(pdfPath: string, context: OcrDocumentContext): Promise<{ pages: PaddlePage[] }> {
  const child = await getWorker();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      if (worker === child) { worker = null; ready = null; child.kill(); }
      reject(new Error('RapidOCR excedeu o limite de tempo para processar o documento.'));
    }, Number(process.env.RAPIDOCR_TIMEOUT_MS) || 900_000);
    timer.unref?.(); pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, path: pdfPath, context })}\n`, error => {
      if (!error) return;
      clearTimeout(timer); pending.delete(id); reject(error);
    });
  });
}

export async function extractWithRapidOCR(fileBuffer: Buffer, filename: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'frete-rapidocr-'));
  const pdfPath = path.join(directory, filename.replace(/[^\w.-]/g, '_') || 'documento.pdf');
  await writeFile(pdfPath, fileBuffer);
  try {
    const result = await requestDocument(pdfPath, buildOcrDocumentContext(filename));
    return parsePaddleMarkdown(result.pages || [], filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) throw new Error('Python não encontrado. Configure RAPIDOCR_PYTHON ou PADDLEOCR_PYTHON.');
    if (/no module named.*(rapidocr|fitz|numpy)|rapidocr.*not installed/i.test(message)) {
      throw new Error('RapidOCR não está instalado neste Python. Instale as dependências de server/requirements-rapidocr.txt.');
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(error => {
      console.warn('[RapidOCR] Não foi possível limpar o PDF temporário:', error);
    });
  }
}
