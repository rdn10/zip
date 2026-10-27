import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Clock,
  Sparkles,
  Settings2,
  Trash2,
  Eye
} from 'lucide-react';
import { UploadedDocument } from '../types.js';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (detectedCity?: string, openReview?: boolean) => void;
  ocrEngine: 'paddle' | 'rapidocr';
  onSetOcrEngine: (engine: 'paddle' | 'rapidocr') => void;
}

interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'PENDING' | 'UPLOADING' | 'PROCESSING_OCR' | 'PROCESSING' | 'COMPLETED' | 'DUPLICATE' | 'ERROR';
  recordsCount?: number;
  originCity?: string;
  durationMs?: number;
  errorMessage?: string;
}

const HISTORY_PAGE_SIZE = 8;

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  ocrEngine,
  onSetOcrEngine
}) => {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [lastImportedCity, setLastImportedCity] = useState<string | null>(null);
  const [documentHistory, setDocumentHistory] = useState<UploadedDocument[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const processingStartedAtRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch document history on open
  useEffect(() => {
    if (isOpen) {
      setHistoryPage(1);
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    await refreshHistory(true);
  };

  const refreshHistory = async (showLoading = false) => {
    if (showLoading) setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocumentHistory(data);
      }
    } catch (err) {
      console.error('Error loading documents history:', err);
    } finally {
      if (showLoading) setIsLoadingHistory(false);
    }
  };

  const hasProcessingHistory = documentHistory.some(doc => doc.processingStatus === 'PROCESSING');
  useEffect(() => {
    if (!isOpen || (!isProcessingQueue && !reprocessingDocumentId && !hasProcessingHistory)) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    const poller = window.setInterval(() => { void refreshHistory(false); }, 5000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(poller);
    };
  }, [isOpen, isProcessingQueue, reprocessingDocumentId, hasProcessingHistory]);

  const formatElapsed = (startedAt: number | string | undefined) => {
    const start = typeof startedAt === 'number' ? startedAt : Date.parse(startedAt || '');
    if (!Number.isFinite(start)) return '00:00';
    const seconds = Math.max(0, Math.floor((clockNow - start) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };

  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    return `${seconds}s`;
  };

  const readableOcrError = (message: string) => /EBUSY|resource busy or locked|unlink/i.test(message)
    ? 'O Windows manteve o PDF temporário ocupado. A limpeza foi ajustada; tente novamente.'
    : message;

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueuedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') || file.type.startsWith('image/')) {
        newItems.push({
          id: `queue-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          progress: 0,
          status: 'PENDING'
        });
      }
    }

    setLastImportedCity(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setQueuedFiles(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessingQueue(false);
    setQueuedFiles(prev =>
      prev.map(f => (f.status === 'UPLOADING' || f.status === 'PROCESSING_OCR' ? { ...f, status: 'PENDING', progress: 0 } : f))
    );
  };

  const processQueue = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    const pending = queuedFiles.filter(f => f.status === 'PENDING');
    if (pending.length === 0) return;
    setIsProcessingQueue(true);
    processingStartedAtRef.current = Date.now();
    abortControllerRef.current = new AbortController();
    let importedCity: string | undefined;

    try {
    for (const item of pending) {
      const itemStartedAt = Date.now();
      try {
        // Step 1: Uploading
        setQueuedFiles(prev =>
          prev.map(f => (f.id === item.id ? { ...f, status: 'UPLOADING', progress: 30 } : f))
        );

        const formData = new FormData();
        formData.append('files', item.file);

        // Step 2: OCR Processing with the selected local OCR engine
        setQueuedFiles(prev =>
          prev.map(f => (f.id === item.id ? { ...f, status: 'PROCESSING_OCR', progress: 35 } : f))
        );

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.error || `Falha no upload (${res.status} ${res.statusText})`);
        }

        let data = await res.json();
        let result = data.results?.[0];

        // Older server processes return DUPLICATE for stale documents with no saved routes.
        // Retry once with force so the user is not blocked by that stale hash record.
        if (result?.status === 'DUPLICATE' && Number(result.recordsExtracted || 0) === 0) {
          setQueuedFiles(prev => prev.map(f => f.id === item.id
            ? { ...f, status: 'PROCESSING_OCR', progress: 35, errorMessage: 'Registro anterior sem rotas; tentando importar novamente...' }
            : f));
          const retryRes = await fetch('/api/documents/upload?force=1', {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current.signal
          });
          if (!retryRes.ok) {
            const errorBody = await retryRes.json().catch(() => null);
            throw new Error(errorBody?.error || `Falha na nova tentativa (${retryRes.status} ${retryRes.statusText})`);
          }
          data = await retryRes.json();
          result = data.results?.[0];
        }

        if (result?.status === 'DUPLICATE') {
          setQueuedFiles(prev =>
            prev.map(f =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'DUPLICATE',
                    progress: 100,
                    recordsCount: result.recordsExtracted || 0,
                    errorMessage: result.message || 'Este arquivo já possui rotas salvas.'
                  }
                : f
            )
          );
        } else if (result?.status === 'PROCESSING') {
          setQueuedFiles(prev =>
            prev.map(f => f.id === item.id
              ? { ...f, status: 'PROCESSING', progress: 65, errorMessage: 'O documento ainda está sendo processado. Atualize o histórico em instantes.' }
              : f)
          );
        } else if (result?.status === 'ERROR') {
          setQueuedFiles(prev =>
            prev.map(f =>
              f.id === item.id
                ? { ...f, status: 'ERROR', progress: 100, errorMessage: result.error || 'Erro no OCR' }
                : f
            )
          );
        } else if (result?.status === 'SUCCESS' && Number(result.recordsExtracted) > 0) {
          const detectedCity = result?.originCity;
          if (detectedCity) {
            setLastImportedCity(detectedCity);
            importedCity = detectedCity;
          }
          setQueuedFiles(prev =>
            prev.map(f =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'COMPLETED',
                    progress: 100,
                    originCity: detectedCity,
                    recordsCount: result?.recordsExtracted || 0,
                    durationMs: Date.now() - itemStartedAt
                  }
                : f
            )
          );
        } else {
          const message = result?.error || result?.message || 'O servidor não confirmou a importação nem salvou rotas. Verifique o histórico e tente reprocessar.';
          setQueuedFiles(prev => prev.map(f => f.id === item.id
            ? { ...f, status: 'ERROR', progress: 100, errorMessage: message }
            : f));
        }
        if (result?.status && result.status !== 'ERROR') {
          await refreshHistory(false);
          setHistoryPage(1);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          break;
        }
        setQueuedFiles(prev =>
          prev.map(f =>
            f.id === item.id ? { ...f, status: 'ERROR', progress: 100, errorMessage: err.message } : f
          )
        );
      }
    }
    } catch (err) {
      console.error('Unexpected error in OCR queue:', err);
      setReprocessError(err instanceof Error ? err.message : 'Erro inesperado ao iniciar a extração OCR.');
    } finally {
      setIsProcessingQueue(false);
      processingStartedAtRef.current = null;
      await loadHistory();
      // Refresh routes after the batch, then let the parent open OCR review.
      if (importedCity) await onImportComplete(importedCity, true);
    }
  };

  const handleGenerateSampleSlip = async () => {
    setIsGeneratingSample(true);
    try {
      const res = await fetch('/api/documents/generate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'QUEIMADOS',
          destination: 'EXTREMA',
          differential: 'CPL'
        })
      });
      if (res.ok) {
        const data = await res.json();
        await loadHistory();
        onImportComplete();
      }
    } catch (err) {
      console.error('Error generating sample:', err);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleReprocess = async (docId: string) => {
    if (reprocessingDocumentId || isProcessingQueue) return;
    setReprocessingDocumentId(docId);
    processingStartedAtRef.current = Date.now();
    setReprocessError(null);
    setDocumentHistory(current => current.map(doc => doc.id === docId
      ? { ...doc, processingStatus: 'PROCESSING', errorMessage: undefined }
      : doc));
    try {
      const res = await fetch(`/api/documents/${docId}/reprocess`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao reprocessar (${res.status})`);
      await loadHistory();
      await onImportComplete(undefined, true);
    } catch (err) {
      console.error('Error reprocessing:', err);
      setReprocessError(err instanceof Error ? err.message : 'Falha ao reprocessar documento.');
      await loadHistory();
    } finally {
      setReprocessingDocumentId(null);
      processingStartedAtRef.current = null;
    }
  };

  const requestClose = () => {
    if ((isProcessingQueue || reprocessingDocumentId) && !window.confirm('A leitura ainda está em andamento. Fechar esta janela não cancela o processamento. Deseja fechar mesmo assim?')) return;
    onClose();
  };

  // Overall progress calculation
  const totalFiles = queuedFiles.length;
  const completedCount = queuedFiles.filter(f => f.status === 'COMPLETED' || f.status === 'DUPLICATE').length;
  const overallProgress = totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0;
  const activeQueuedFile = queuedFiles.find(f => f.status === 'PROCESSING_OCR' || f.status === 'UPLOADING');
  const historyPageCount = Math.max(1, Math.ceil(documentHistory.length / HISTORY_PAGE_SIZE));
  const visibleHistory = documentHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                IMPORTAR DOCUMENTOS & OCR DE FRETES
              </h2>
              <p className="text-xs text-neutral-400">
                Leitura e extração automática dos dados dos seus PDFs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <span>OCR local</span>
              <select
                value={ocrEngine}
                onChange={event => onSetOcrEngine(event.target.value as 'paddle' | 'rapidocr')}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-white"
                aria-label="Mecanismo local de OCR"
              >
                <option value="paddle">PaddleOCR</option>
                <option value="rapidocr">RapidOCR</option>
              </select>
            </label>
            <button
              onClick={requestClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Drag & Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-red-500 bg-red-500/10'
                : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => handleFilesAdded(e.target.files)}
              multiple
              accept=".pdf,application/pdf,image/*"
              className="hidden"
            />
            <UploadCloud className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-white mb-1">
              Arraste e solte seus arquivos PDF aqui, ou clique para selecionar
            </p>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mb-4">
              Suporta múltiplos PDFs de transporte preenchidos manualmente ou digitalizados.
              O sistema preserva documentos anteriores e acumula à base centralizada.
            </p>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-all shadow"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Selecionar Arquivos PDF
            </button>
          </div>

          {/* Quick Demo Test Slip Generator */}
          <div className="flex items-center justify-between p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-lg">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white">Não possui um PDF em mãos agora?</span>
                <p className="text-neutral-400 text-[11px]">
                  Gere instantaneamente uma folha manuscrita simulada e teste a extração OCR e expansão de códigos.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateSampleSlip}
              disabled={isGeneratingSample}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 rounded text-xs font-bold transition-all shrink-0"
            >
              {isGeneratingSample ? 'Processando...' : 'Gerar & Testar PDF'}
            </button>
          </div>

          {/* Success Direct Jump Banner */}
          {lastImportedCity && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-600/70 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-white text-sm">
                    Rotas importadas com sucesso!
                  </p>
                  <p className="text-emerald-300">
                    Os registros extraídos foram adicionados à planilha de <strong>{lastImportedCity}</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onImportComplete(lastImportedCity);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition-all whitespace-nowrap text-xs"
              >
                Abrir Planilha de {lastImportedCity} →
              </button>
            </div>
          )}

          {/* Current Queue Section */}
          {queuedFiles.length > 0 && (
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Fila de arquivos</h3>
                  <p className="mt-1 text-[11px] text-neutral-400">{queuedFiles.length} arquivo(s) · {completedCount} concluído(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessingQueue ? (
                    <button
                      onClick={cancelProcessing}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-red-400 border border-red-500/30 rounded text-xs font-bold"
                    >
                      Cancelar Processamento
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={event => { void processQueue(event); }}
                      disabled={!queuedFiles.some(f => f.status === 'PENDING')}
                      aria-busy={isProcessingQueue}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white font-bold text-xs rounded transition-all"
                    >
                      {isProcessingQueue ? 'Processando OCR...' : 'Iniciar Extração OCR'}
                    </button>
                  )}
                </div>
              </div>

              {/* Overall Progress Bar */}
              {isProcessingQueue && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                    <span className="min-w-0 truncate">
                      {activeQueuedFile
                        ? `${activeQueuedFile.status === 'PROCESSING_OCR' ? 'Lendo' : 'Enviando'}: ${activeQueuedFile.name} · ${formatElapsed(processingStartedAtRef.current || undefined)}`
                        : 'Preparando próximo arquivo...'}
                    </span>
                    <span className="shrink-0">{completedCount} de {totalFiles} concluídos</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  {queuedFiles.some(f => f.status === 'PROCESSING_OCR') && (
                    <p className="text-[10px] text-neutral-400">Leitura local pelo {ocrEngine === 'rapidocr' ? 'RapidOCR' : 'PaddleOCR'}. A barra mostra arquivos concluídos; não há percentual interno da leitura.</p>
                  )}
                </div>
              )}

              {/* Queued files list */}
              <div className="space-y-2">
                {queuedFiles.map(item => (
                  <React.Fragment key={item.id}>
                  <div
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="truncate">
                        <p className="font-semibold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          {(item.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Status Badge */}
                      {item.status === 'PENDING' && (
                        <span className="text-[11px] text-neutral-400 font-medium">Pendente</span>
                      )}
                      {item.status === 'UPLOADING' && (
                        <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Enviando...
                        </span>
                      )}
                      {item.status === 'PROCESSING_OCR' && (
                        <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Lendo PDF...
                        </span>
                      )}
                      {item.status === 'PROCESSING' && (
                        <span className="text-[11px] text-amber-400 font-medium" title={item.errorMessage}>
                          Já está em processamento
                        </span>
                      )}
                      {item.status === 'COMPLETED' && (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> {item.recordsCount} rotas extraídas · {item.durationMs != null ? formatDuration(item.durationMs) : 'concluído'}
                        </span>
                      )}
                      {item.status === 'DUPLICATE' && (
                        <span className="text-[11px] text-amber-300 font-medium" title={item.errorMessage}>
                          {(item.recordsCount ?? 0) > 0 ? `Já importado · ${item.recordsCount} rotas` : 'Sem rotas · precisa tentar novamente'}
                        </span>
                      )}
                      {item.status === 'ERROR' && (
                        <span className="text-[11px] text-red-400 font-medium" title={item.errorMessage}>
                          Erro no OCR
                        </span>
                      )}

                      {!isProcessingQueue && item.status === 'PENDING' && (
                        <button
                          onClick={() => setQueuedFiles(prev => prev.filter(f => f.id !== item.id))}
                          className="p-1 text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isProcessingQueue && item.status === 'DUPLICATE' && (item.recordsCount ?? 0) === 0 && (
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            setQueuedFiles(prev => prev.map(file => file.id === item.id
                              ? { ...file, status: 'PENDING', progress: 0, errorMessage: undefined }
                              : file));
                          }}
                          className="rounded bg-red-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600"
                        >
                          Tentar importar
                        </button>
                      )}
                    </div>
                  </div>
                  {item.status === 'ERROR' && item.errorMessage && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words text-[11px] text-red-300" title={item.errorMessage}>{readableOcrError(item.errorMessage)}</p>
                      <button
                        onClick={() => setQueuedFiles(prev => prev.map(file => file.id === item.id
                          ? { ...file, status: 'PENDING', progress: 0, errorMessage: undefined }
                          : file))}
                        className="shrink-0 rounded border border-red-800 px-2 py-1 text-[10px] font-bold text-red-300 hover:bg-red-950"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Historical Documents Table */}
          <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                HISTÓRICO DE DOCUMENTOS IMPORTADOS ({documentHistory.length})
              </span>
              <button
                onClick={loadHistory}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>
            {reprocessError && <p className="text-xs text-red-300">Falha ao reprocessar: {reprocessError}</p>}
            {isProcessingQueue && (
              <p className="text-[11px] text-neutral-400">O {ocrEngine === 'rapidocr' ? 'RapidOCR' : 'PaddleOCR'} lê os documentos localmente. PDFs digitalizados ou com muitas páginas podem levar mais tempo.</p>
            )}

            {isLoadingHistory ? (
              <div className="py-6 text-center text-xs text-neutral-500">Carregando histórico...</div>
            ) : documentHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500 bg-neutral-950/50 rounded-lg border border-neutral-800">
                Nenhum documento importado ainda.
              </div>
            ) : (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800/80">
                {visibleHistory.map(doc => (
                  <React.Fragment key={doc.id}>
                  <div
                    className="p-3 flex items-center justify-between text-xs hover:bg-neutral-900/60 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-white truncate">{doc.filename}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        Hash: {doc.fileHash.substring(0, 16)}... ·{' '}
                        {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(doc.uploadedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {doc.processingStatus === 'COMPLETED' && doc.processingStartedAt && doc.processedAt && (
                        <p className="text-[10px] text-emerald-400">
                          Concluído em {formatDuration(Date.parse(doc.processedAt) - Date.parse(doc.processingStartedAt))}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-neutral-300 font-bold text-[11px]">
                        {doc.totalRecordsExtracted} rotas
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          doc.processingStatus === 'COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : doc.processingStatus === 'PROCESSING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {doc.processingStatus === 'ERROR'
                          ? 'FALHOU'
                          : doc.processingStatus === 'PROCESSING'
                          ? `PROCESSANDO · ${formatElapsed(doc.processingStartedAt || doc.uploadedAt)}`
                          : doc.processingStatus}
                      </span>

                      {doc.processingStatus === 'ERROR' && (
                        <span className="max-w-48 truncate text-[10px] text-red-300" title={doc.errorMessage || 'Falha ao processar PDF'}>
                          {readableOcrError(doc.errorMessage || 'Falha ao processar PDF')}
                        </span>
                      )}

                      <button
                        onClick={() => handleReprocess(doc.id)}
                        disabled={Boolean(reprocessingDocumentId) || isProcessingQueue}
                        title={reprocessingDocumentId === doc.id ? 'Processando documento...' : doc.processingStatus === 'ERROR' ? 'Tentar importar este PDF novamente' : 'Reprocessar OCR'}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${reprocessingDocumentId === doc.id ? 'animate-spin' : ''}`} />
                        {doc.processingStatus === 'ERROR' && 'Tentar novamente'}
                      </button>
                    </div>
                  </div>
                  {reprocessingDocumentId === doc.id && (
                    <div className="px-3 pb-2">
                      <p className="mb-1 text-[10px] text-amber-300">Reenviando documento para leitura OCR...</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                        <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" />
                      </div>
                    </div>
                  )}
                  </React.Fragment>
                ))}
              </div>
            )}
            {!isLoadingHistory && documentHistory.length > HISTORY_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-neutral-400">
                <span>
                  Página {historyPage} de {historyPageCount} · {documentHistory.length} documentos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryPage(page => Math.max(1, page - 1))}
                    disabled={historyPage <= 1}
                    className="rounded border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryPage(page => Math.min(historyPageCount, page + 1))}
                    disabled={historyPage >= historyPageCount}
                    className="rounded border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span>Armazenamento local seguro e centralizado em banco de dados</span>
          <button
            onClick={requestClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-semibold text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
