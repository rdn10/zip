import React from 'react';
import { Home, Plus, FileUp, ClipboardCheck, Building2, Download } from 'lucide-react';
import { City, RouteRecord } from '../types.js';

interface ExcelTabBarProps {
  cities: City[];
  routes?: RouteRecord[];
  activeTab: string; // 'INICIO', 'ALL', city.name, 'IMPORT', 'REVIEW', 'CITIES'
  onSelectTab: (tab: string) => void;
  onAddCity: () => void;
  pendingReviewsCount?: number;
  onOpenExport: () => void;
}

export const ExcelTabBar: React.FC<ExcelTabBarProps> = ({
  cities,
  routes = [],
  activeTab,
  onSelectTab,
  onAddCity,
  pendingReviewsCount = 0,
  onOpenExport
}) => {
  // Only show origins that actually have routes created
  const originCityNames = React.useMemo(() => {
    const set = new Set<string>();
    routes.forEach(r => {
      if (r.originCity) set.add(r.originCity.toUpperCase().trim());
    });
    // Always include currently active city tab if selected
    if (activeTab && activeTab !== 'INICIO' && activeTab !== 'ALL' && activeTab !== 'IMPORT' && activeTab !== 'REVIEW' && activeTab !== 'CITIES') {
      set.add(activeTab.toUpperCase().trim());
    }
    return Array.from(set).sort();
  }, [routes, activeTab]);

  return (
    <div className="bg-[#0f1724] border-b border-neutral-800 text-xs select-none">
      <div className="flex min-w-0 items-center gap-2 border-b border-white/5 px-3">
        <nav aria-label="Navegação das rotas" className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => onSelectTab('INICIO')}
            title="Ir para a capa"
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-bold transition-colors ${
              activeTab === 'INICIO'
                ? 'bg-red-950/60 text-white ring-1 ring-red-900/70'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <Home className={`h-3.5 w-3.5 ${activeTab === 'INICIO' ? 'text-red-400' : ''}`} />
            <span>Início</span>
          </button>

          {originCityNames.length > 0 && (
            <button
              onClick={() => onSelectTab('ALL')}
              title="Visualizar rotas de todas as origens"
              className={`shrink-0 rounded-lg px-3 py-2 font-semibold transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-neutral-700 text-white ring-1 ring-neutral-600'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              Todas as origens
            </button>
          )}

          {originCityNames.map(cityName => {
            const isActive = activeTab === cityName;
            return (
              <button
                key={cityName}
                onClick={() => onSelectTab(cityName)}
                title={`Abrir rotas de ${cityName}`}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold transition-colors ${
                  isActive
                    ? 'bg-neutral-700 text-white ring-1 ring-neutral-600'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                {cityName}
              </button>
            );
          })}

          <span className="mx-1 h-6 shrink-0 border-l border-neutral-700" aria-hidden="true" />
          <button
            onClick={onAddCity}
            title="Cadastrar cidade ou código"
            aria-label="Cadastrar cidade ou código"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </nav>
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 sm:block">
          Ações do sistema
        </span>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-neutral-800 bg-neutral-950/70 p-1">
          <button
            onClick={() => onSelectTab('IMPORT')}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold transition-colors ${
              activeTab === 'IMPORT'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <FileUp className="h-3.5 w-3.5 text-red-400" />
            <span>Importar PDFs</span>
          </button>

          <button
            onClick={() => onSelectTab('REVIEW')}
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold transition-colors ${
              activeTab === 'REVIEW'
                ? 'bg-amber-500/15 text-white ring-1 ring-amber-500/40'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Revisão OCR</span>
            {pendingReviewsCount > 0 && (
              <span className="min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-neutral-950">
                {pendingReviewsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('CITIES')}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold transition-colors ${
              activeTab === 'CITIES'
                ? 'bg-blue-500/15 text-white ring-1 ring-blue-500/40'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Cidades e códigos</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
