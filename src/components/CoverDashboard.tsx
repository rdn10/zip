import React, { useState } from 'react';
import { Logo } from './Logo.js';
import { City, Stats } from '../types.js';
import {
  MapPin,
  Route as RouteIcon,
  Truck,
  FileUp,
  Building2,
  Plus,
  Search
} from 'lucide-react';

interface CoverDashboardProps {
  stats: Stats;
  cities: City[];
  selectedCityName: string;
  onSelectCity: (cityName: string) => void;
  onOpenImport: () => void;
  onOpenCities: () => void;
  onAddNewRoute?: (cityName: string) => void;
}

export const CoverDashboard: React.FC<CoverDashboardProps> = ({
  stats,
  cities,
  selectedCityName,
  onSelectCity,
  onOpenImport,
  onOpenCities,
  onAddNewRoute
}) => {
  const [citySearch, setCitySearch] = useState('');
  const matchingCities = cities
    .filter(city => city.active && city.name.toLocaleLowerCase('pt-BR').includes(citySearch.trim().toLocaleLowerCase('pt-BR')))
    .slice(0, 8);

  const openCity = (cityName: string) => {
    onSelectCity(cityName);
    setCitySearch('');
  };

  return (
    <div className="relative h-full w-full overflow-y-auto bg-neutral-950 px-5 py-6 text-white sm:px-8 lg:px-10">
      {/* Background Graphic Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src="/assets/caminhao-019.webp"
          alt="Caminhão Monfredini Transportes"
          className="h-full w-full scale-105 object-cover object-[center_62%] opacity-25 blur-[2px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/85 to-neutral-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(185,28,28,0.14),_transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full items-center py-2">
        <section className="mx-auto w-full max-w-6xl space-y-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="shrink-0"><Logo size="lg" /></div>
            <div className="space-y-1 border-l-[3px] border-red-600 pl-4">
              <h1 className="text-3xl font-extrabold leading-none tracking-tight text-white uppercase font-sans sm:text-4xl lg:text-5xl">
                TABELA DE ROTAS
              </h1>
              <h2 className="text-2xl font-black leading-tight tracking-tight text-red-500 uppercase font-sans sm:text-3xl">
                MERCADO LIVRE
              </h2>
              <p className="pt-1 text-xs font-semibold tracking-wider text-neutral-300 uppercase sm:text-sm">
                COTAÇÕES E VALORES DE TRANSPORTE
              </p>
            </div>
          </div>

        {/* Zero Routes State Notice */}
        {stats.totalRoutes === 0 && (
          <div className="bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-950 border border-emerald-800/40 rounded-xl p-4 shadow-lg space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-white font-extrabold text-xs tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{stats.totalCities} Bases Mercado Livre Cadastradas como Padrão</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Todos os endereços, siglas, restrições e códigos operacionais do Mercado Livre estão cadastrados no sistema. A lista de rotas está limpa (0 rotas) pronta para importar seus PDFs de frete ou cadastrar novas cotações.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={onOpenImport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition-all shadow-md"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Importar PDFs de Frete</span>
              </button>
              <button
                onClick={onOpenCities}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-xs font-semibold transition-all"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Ver Bases e Códigos ({stats.totalCities})</span>
              </button>
              {onAddNewRoute && (
                <button
                  onClick={() => onAddNewRoute(selectedCityName || 'RIO DE JANEIRO')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-xs font-semibold transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-red-400" />
                  <span>Nova Rota Manual</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3 Stat Cards matching screenshot: CIDADES, ROTAS, VEICULOS */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* CIDADES */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center shadow-lg transition-all hover:border-red-900/70 hover:bg-neutral-900">
            <MapPin className="w-5 h-5 text-red-500 mb-1" />
            <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
              CIDADES
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5 tabular-nums">
              {stats.totalCities}
            </span>
          </div>

          {/* ROTAS */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center shadow-lg transition-all hover:border-red-900/70 hover:bg-neutral-900">
            <RouteIcon className="w-5 h-5 text-red-500 mb-1" />
            <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
              ROTAS
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5 tabular-nums">
              {stats.totalRoutes}
            </span>
          </div>

          {/* VEÍCULOS */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center shadow-lg transition-all hover:border-red-900/70 hover:bg-neutral-900">
            <Truck className="w-5 h-5 text-red-500 mb-1" />
            <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
              VEÍCULOS
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5 tabular-nums">
              {stats.vehicleProfilesCount}
            </span>
            <span className="text-[9px] text-neutral-400 uppercase">POR ROTA</span>
          </div>
        </div>

        {/* Search city and open its routes */}
        <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-xl sm:p-6">
          <label htmlFor="home-city-search" className="text-xs font-black text-white uppercase tracking-wider">
            Buscar cidade para abrir as rotas
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              id="home-city-search"
              value={citySearch}
              onChange={event => setCitySearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && matchingCities[0]) {
                  event.preventDefault();
                  openCity(matchingCities[0].name);
                }
              }}
              placeholder="Digite o nome da cidade..."
              autoComplete="off"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-10 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
            {citySearch.trim() && (
              <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-1 shadow-xl">
                {matchingCities.length ? matchingCities.map(city => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => openCity(city.name)}
                    className="block w-full rounded px-3 py-2 text-left text-xs font-semibold text-neutral-200 hover:bg-red-600 hover:text-white"
                  >
                    {city.name}
                  </button>
                )) : (
                  <p className="px-3 py-2 text-xs text-neutral-400">Nenhuma cidade encontrada.</p>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-neutral-400">Digite e selecione uma cidade para abrir a tabela de rotas.</p>
        </div>

        </section>

      </div>

      {/* Footer Info */}
      <div className="relative z-10 mx-auto mt-5 flex w-full items-center justify-between border-t border-neutral-900 pt-4 text-[10px] text-neutral-500">
        <span>Monfredini Transportes © 2026</span>
        <span className="font-mono">OCR local · PaddleOCR / RapidOCR</span>
      </div>
    </div>
  );
};
