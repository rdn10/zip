import React, { useState, useRef } from 'react';
import { Download, FileSpreadsheet, X, CheckCircle, Loader2, Database, Upload, AlertCircle, HardDrive } from 'lucide-react';
import { City } from '../types.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  currentCityName?: string;
  onDataRestored?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cities,
  currentCityName,
  onDataRestored
}) => {
  const [activeTab, setActiveTab] = useState<'EXCEL' | 'BACKUP'>('EXCEL');
  const [selectedCity, setSelectedCity] = useState<string>(currentCityName || 'ALL');
  const [selectedDifferential, setSelectedDifferential] = useState<string>('ALL');
  const [onlyReviewed, setOnlyReviewed] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Backup & Restore states
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setDownloadSuccess(false);

    try {
      const res = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: selectedCity === 'ALL' ? undefined : selectedCity,
          differential: selectedDifferential === 'ALL' ? undefined : selectedDifferential,
          onlyReviewed
        })
      });

      if (!res.ok) {
        throw new Error('Falha ao gerar arquivo Excel no servidor');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tabela_Rotas_Monfredini_${selectedCity === 'ALL' ? 'Geral' : selectedCity}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Error downloading Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/backup';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreMessage(null);
    setRestoreError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao restaurar backup');

      setRestoreMessage(`Backup restaurado! ${data.stats.totalRoutes} rotas e ${data.stats.totalCities} bases carregadas.`);
      if (onDataRestored) {
        onDataRestored();
      }
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setRestoreError(err.message || 'Arquivo de backup inválido.');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeTab === 'EXCEL' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>
              {activeTab === 'EXCEL' ? <FileSpreadsheet className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                EXPORTAR E SALVAR DADOS
              </h2>
              <p className="text-xs text-neutral-400">
                Gere planilhas Excel ou salve uma cópia de segurança na sua máquina
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-6 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('EXCEL')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'EXCEL'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Planilha Excel (.XLSX)</span>
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'BACKUP'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Salvar / Restaurar Dados (.JSON)</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 text-xs">
          {activeTab === 'EXCEL' ? (
            <>
              <div>
                <label className="block text-neutral-300 font-bold mb-1.5">
                  Escopo de Cidades:
                </label>
                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-white font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="ALL">Todas as Cidades e Rotas (Geral)</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>
                      Apenas {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1.5">
                  Filtro de Diferencial:
                </label>
                <select
                  value={selectedDifferential}
                  onChange={e => setSelectedDifferential(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-white font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="ALL">Todos os Diferenciais (Normal, CPL, Circuito)</option>
                  <option value="NORMAL">Somente NORMAL</option>
                  <option value="CPL">Somente CPL</option>
                  <option value="CIRCUITO">Somente CIRCUITO</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer bg-neutral-950 p-3 rounded border border-neutral-800">
                  <input
                    type="checkbox"
                    checked={onlyReviewed}
                    onChange={e => setOnlyReviewed(e.target.checked)}
                    className="rounded accent-red-600"
                  />
                  <div>
                    <span className="font-bold text-white block">
                      Exportar apenas registros revisados
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      Ignora registros com status "Aguardando Conferência" ou com dúvidas de OCR
                    </span>
                  </div>
                </label>
              </div>

              {/* Visual format guarantee notice */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded text-[11px] text-neutral-400 space-y-1">
                <span className="font-bold text-neutral-300">Formatado conforme referência:</span>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-400">
                  <li>Capa personalizada com resumo e atalhos</li>
                  <li>Aba individual para cada cidade de origem</li>
                  <li>Títulos de rotas em vermelho vibrante com códigos</li>
                  <li>Cabeçalhos em azul escuro e linhas alternadas</li>
                </ul>
              </div>

              {downloadSuccess && (
                <div className="p-3 bg-emerald-950 border border-emerald-800 rounded flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Download da planilha iniciado com sucesso!</span>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span>1. Baixar Cópia dos Dados para a Minha Máquina</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Baixe um arquivo seguro com todas as 158 bases cadastradas, rotas e configurações. Você pode guardar esse arquivo no seu disco local como garantia de segurança.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs transition-colors shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Salvar Arquivo de Dados (.JSON) na Minha Máquina</span>
                </button>
              </div>

              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>2. Restaurar Dados do Meu Computador</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Selecione um arquivo de backup (.json) salvo no seu computador para carregar de volta no sistema instantaneamente.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 text-neutral-200 border border-neutral-700 rounded font-bold text-xs transition-colors"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Restaurando dados...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>Selecionar Arquivo .JSON do Computador</span>
                    </>
                  )}
                </button>
              </div>

              {restoreMessage && (
                <div className="p-3 bg-emerald-950 border border-emerald-800 rounded flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{restoreMessage}</span>
                </div>
              )}

              {restoreError && (
                <div className="p-3 bg-red-950 border border-red-800 rounded flex items-center gap-2 text-red-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold"
          >
            Fechar
          </button>

          {activeTab === 'EXCEL' && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-white rounded text-xs font-bold transition-all shadow-md"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Planilha...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Planilha Excel</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
