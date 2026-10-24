import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, Check, Trash2, Building2 } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (keepCities: boolean) => Promise<void>;
  isResetting: boolean;
  stats: {
    totalCities: number;
    totalRoutes: number;
    totalDocuments: number;
    totalRecords: number;
  };
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  isResetting,
  stats
}) => {
  const [keepCities, setKeepCities] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-red-900/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-red-950/60 border-b border-red-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/30 text-red-400 rounded-lg">
              <RotateCcw className="w-5 h-5 text-red-500 animate-spin-reverse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white uppercase tracking-wide">
                Zerar Informações do Sistema
              </h2>
              <p className="text-xs text-red-300">
                Limpar rotas, documentos e cidades para adicionar seus próprios dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isResetting}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white text-xs">
                Você está prestes a zerar todas as informações.
              </p>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Todas as linhas de rotas, cotações extraídas de PDFs e arquivos de upload anteriores serão apagados. O sistema ficará 100% limpo para você inserir suas próprias cidades, planilhas e cotações.
              </p>
            </div>
          </div>

          {/* Current Counts to be cleared */}
          <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-800/80 grid grid-cols-4 gap-2 text-center">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Cidades</span>
              <span className="text-base font-black text-red-400 font-mono">{stats.totalCities}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Rotas</span>
              <span className="text-base font-black text-red-400 font-mono">{stats.totalRoutes}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Registros</span>
              <span className="text-base font-black text-red-400 font-mono">{stats.totalRecords}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Documentos</span>
              <span className="text-base font-black text-red-400 font-mono">{stats.totalDocuments}</span>
            </div>
          </div>

          {/* Keep cities option */}
          <div className="pt-2">
            <label className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition-colors">
              <input
                type="checkbox"
                checked={keepCities}
                onChange={e => setKeepCities(e.target.checked)}
                className="mt-0.5 rounded accent-red-600 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Preservar cidades existentes (se houver alguma)</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Deixe desmarcado para zerar também qualquer cidade cadastrada e começar com zero cidades.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmReset(keepCities)}
            disabled={isResetting}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 text-white rounded text-xs font-bold transition-all shadow-md"
          >
            {isResetting ? (
              <span>Zerando informações...</span>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Sim, Zerar Todas as Informações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
