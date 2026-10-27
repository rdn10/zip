import React, { useState, useMemo } from 'react';
import { City, RouteRecord } from '../types.js';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MapPin
} from 'lucide-react';

const TABLES_PER_PAGE = 2;

const normalizeFilterText = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const renderCodeParts = (value: string, badge = false) => {
  const parts = String(value || '').split('/').filter(Boolean);
  return (
    <span className="inline-flex max-w-full flex-wrap justify-center">
      {parts.map((part, index) => (
        <span
          key={`${part}-${index}`}
          className={`whitespace-nowrap ${badge ? 'px-1 py-0.5 bg-neutral-200 rounded text-neutral-800' : ''}`}
        >
          {part}{index < parts.length - 1 ? '/' : ''}
        </span>
      ))}
    </span>
  );
};

interface RouteTableProps {
  currentCityName: string;
  baseView?: boolean;
  selectedBase?: City;
  routes: RouteRecord[];
  allCities: string[];
  onSelectCity: (cityName: string) => void;
  onEditRecord: (record: RouteRecord) => void;
  onDeleteRecord: (id: string) => void;
  onAddNewRoute: (originCity: string) => void;
  onOpenImport?: () => void;
}

export const RouteTable: React.FC<RouteTableProps> = ({
  currentCityName,
  baseView = false,
  selectedBase,
  routes,
  allCities,
  onSelectCity,
  onEditRecord,
  onDeleteRecord,
  onAddNewRoute,
  onOpenImport
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [differentialFilter, setDifferentialFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'type' | 'value' | 'destination'>('destination');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Only origin cities that actually have routes (or the currently selected city)
  const allOriginCities = useMemo(() => {
    const set = new Set<string>();
    routes.forEach(r => {
      if (r.originCity) set.add(r.originCity.toUpperCase().trim());
    });
    if (currentCityName && currentCityName !== 'ALL') {
      set.add(currentCityName.toUpperCase().trim());
    }
    return Array.from(set).sort();
  }, [routes, currentCityName]);

  // Filter routes belonging to this origin city (or all if currentCityName === 'ALL' or empty)
  const cityRoutes = useMemo(() => {
    if (!currentCityName || currentCityName === 'ALL' || currentCityName === 'TODAS') {
      return routes;
    }
    const selectedCity = currentCityName.trim().toUpperCase();
    return routes.filter(r => {
      const origin = r.originCity.trim().toUpperCase();
      return baseView
        ? origin === selectedCity || r.destinationCity.trim().toUpperCase() === selectedCity
        : origin === selectedCity;
    });
  }, [routes, currentCityName, baseView]);

  // Apply search & differential filter
  const filteredRoutes = useMemo(() => {
    let list = [...cityRoutes];

    if (differentialFilter !== 'ALL') {
      const selectedDifferential = normalizeFilterText(differentialFilter).toUpperCase();
      if (selectedDifferential === 'NORMAL') {
        list = list.filter(r => {
          const differential = String(r.differential ?? '').trim().toUpperCase();
          return !differential || differential === '-' || differential === 'NORMAL';
        });
      } else {
        list = list.filter(r => String(r.differential ?? '').trim().toUpperCase() === selectedDifferential);
      }
    }

    if (searchQuery.trim()) {
      const terms = normalizeFilterText(searchQuery).split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const searchableText = normalizeFilterText([
          r.originCity,
          r.destinationCity,
          r.destinationCode,
          r.originCode,
          r.vehicleType,
          r.client,
          r.totalValue,
          r.numericValue,
          r.differential,
          r.documentName
        ].join(' '));
        return terms.every(term => searchableText.includes(term));
      });
    }

    return list;
  }, [cityRoutes, differentialFilter, searchQuery]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || differentialFilter !== 'ALL';
  const clearFilters = () => {
    setSearchQuery('');
    setDifferentialFilter('ALL');
  };

  // Group routes by Origin + Destination + Destination Code + Differential
  const groupedSections = useMemo(() => {
    const groups: {
      key: string;
      title: string;
      originCity: string;
      destination: string;
      destinationCode: string;
      differential: string;
      records: RouteRecord[];
    }[] = [];

    const map = new Map<string, RouteRecord[]>();

    for (const rec of filteredRoutes) {
      const key = `${rec.originCity}__${rec.destinationCity}__${rec.destinationCode}__${rec.differential}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(rec);
    }

    // Convert map to sorted list
    for (const [key, records] of map.entries()) {
      if (records.length === 0) continue;
      const first = records[0];
      const diffLabel = first.differential && first.differential !== 'NORMAL' && first.differential !== '-'
        ? ` (${first.differential})`
        : '';
      const title = `${first.originCity} → ${first.destinationCity}${diffLabel} | CÓDIGO DESTINO: ${first.destinationCode}`;

      // Sort records within group by default standard vehicle hierarchy or sort criteria
      const profileGroup = (vehicleType: string) => {
        if (/3\s*(?:º|°|o)|TERCEIRO/i.test(vehicleType)) return 0;
        return 1;
      };
      const hasRouteValue = (record: RouteRecord) => {
        const shownValue = String(record.totalValue ?? '').trim();
        return shownValue !== '' && shownValue !== '-' && /\d/.test(shownValue);
      };
      const comparableValue = (record: RouteRecord) => {
        if (typeof record.numericValue === 'number' && Number.isFinite(record.numericValue)) return record.numericValue;
        const normalized = String(record.totalValue ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      records.sort((a, b) => {
        const valuePresenceDifference = Number(hasRouteValue(b)) - Number(hasRouteValue(a));
        if (valuePresenceDifference !== 0) return valuePresenceDifference;
        const groupDifference = profileGroup(a.vehicleType) - profileGroup(b.vehicleType);
        if (groupDifference !== 0) return groupDifference;
        if (sortBy === 'value') {
          const valA = comparableValue(a);
          const valB = comparableValue(b);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
      });

      groups.push({
        key,
        title,
        originCity: first.originCity,
        destination: first.destinationCity,
        destinationCode: first.destinationCode,
        differential: first.differential,
        records
      });
    }

    // Sort groups by destination then origin
    groups.sort((a, b) => a.destination.localeCompare(b.destination));

    return groups;
  }, [filteredRoutes, sortBy, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(groupedSections.length / TABLES_PER_PAGE));
  const visiblePage = Math.min(currentPage, pageCount);
  const visibleSections = groupedSections.slice(
    (visiblePage - 1) * TABLES_PER_PAGE,
    visiblePage * TABLES_PER_PAGE
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [currentCityName, baseView, searchQuery, differentialFilter]);

  const renderPagination = () => pageCount > 1 ? (
    <nav
      aria-label="Paginação das tabelas de rotas"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-xs"
    >
      <span className="text-neutral-300">
        Total: <strong className="text-white">{groupedSections.length} {groupedSections.length === 1 ? 'tabela' : 'tabelas'}</strong>
        <span className="ml-2 text-neutral-500">
          · Exibindo {visibleSections.length} nesta página ({(visiblePage - 1) * TABLES_PER_PAGE + 1}–{Math.min(visiblePage * TABLES_PER_PAGE, groupedSections.length)})
        </span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage(visiblePage - 1)}
          disabled={visiblePage <= 1}
          className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2.5 py-1.5 font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <span aria-live="polite" className="min-w-20 text-center font-bold text-white">
          Página {visiblePage} de {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage(visiblePage + 1)}
          disabled={visiblePage >= pageCount}
          className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2.5 py-1.5 font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  ) : null;

  if (allOriginCities.length === 0 && routes.length === 0) {
    return (
      <div className="flex flex-col w-full h-full bg-neutral-900 text-neutral-100 overflow-y-auto">
        <div className="p-12 text-center max-w-xl mx-auto my-auto space-y-4">
          <AlertCircle className="w-12 h-12 text-neutral-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Nenhuma cidade de origem cadastrada ainda</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {baseView
              ? `Nenhuma rota está vinculada a ${currentCityName} como origem ou destino. Os dados cadastrados desta base estão abaixo.`
              : 'O sistema está totalmente zerado. Você pode cadastrar suas cidades de origem e códigos operacionais ou importar suas folhas de transporte em PDF para que o sistema as cadastre automaticamente.'}
          </p>
          {baseView && selectedBase && (
            <div className="mx-auto max-w-lg rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-left text-xs text-neutral-300">
              <div className="mb-2 flex items-center justify-between gap-3">
                <strong className="text-sm text-white">{selectedBase.name}{selectedBase.state ? ` · ${selectedBase.state}` : ''}</strong>
                <span className="rounded bg-emerald-950 px-2 py-1 font-bold uppercase text-emerald-400">{selectedBase.active ? 'Ativa' : 'Inativa'}</span>
              </div>
              <p><span className="text-neutral-500">Códigos:</span> {selectedBase.codes?.filter(code => code.active).map(code => code.code).join(', ') || 'Nenhum cadastrado'}</p>
              {selectedBase.address && <p className="mt-1"><span className="text-neutral-500">Endereço:</span> {selectedBase.address}</p>}
              {selectedBase.cnpj && <p className="mt-1"><span className="text-neutral-500">CNPJ:</span> {selectedBase.cnpj}</p>}
              {selectedBase.restrictions && <p className="mt-1"><span className="text-neutral-500">Restrições:</span> {selectedBase.restrictions}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onAddNewRoute('')}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-all shadow"
            >
              + Cadastrar Nova Rota
            </button>
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold text-xs rounded transition-all"
              >
                Importar PDFs com OCR
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-neutral-900 text-neutral-100 overflow-y-auto">
      {/* City Hero Header Banner */}
      <div className="relative bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-b border-neutral-800 px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-7 bg-red-600 rounded-sm" />
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-sans">
                {currentCityName === 'ALL' || !currentCityName ? 'TODAS AS ORIGENS' : currentCityName}
              </h1>
            </div>
            <p className="text-xs text-neutral-400 tracking-wider uppercase font-semibold mt-1 pl-4">
              {currentCityName === 'ALL' || !currentCityName
                ? `VISÃO GERAL DE TODAS AS ROTAS DO SISTEMA (${cityRoutes.length} COTAÇÕES)`
                : 'ROTAS DISPONÍVEIS & COTAÇÕES ATIVAS DESTA CIDADE DE ORIGEM'}
            </p>
          </div>

          {/* Quick city selector dropdown + new route button */}
          <div className="flex flex-wrap items-end justify-start gap-2 w-full sm:w-auto sm:justify-end">
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider flex items-center justify-end gap-1">
                <MapPin className="w-3 h-3 text-red-500" />
                CIDADE DE ORIGEM
              </span>
              <select
                value={currentCityName || 'ALL'}
                onChange={e => onSelectCity(e.target.value)}
                aria-label="Selecionar cidade de origem"
                className="bg-neutral-800 border border-neutral-700 text-white text-xs font-bold rounded px-3 py-1.5 focus:outline-none focus:border-red-500 uppercase cursor-pointer"
              >
                <option value="ALL">Todas as Cidades de Origem ({routes.length})</option>
                {allOriginCities.map(city => {
                  const count = routes.filter(r => r.originCity.trim().toUpperCase() === city.trim().toUpperCase()).length;
                  return (
                    <option key={city} value={city}>
                      {city} {count > 0 ? `(${count} rotas)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => onAddNewRoute(currentCityName === 'ALL' ? (allOriginCities[0] || '') : currentCityName)}
              className="mt-3 sm:mt-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition-all shadow-md shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Rota</span>
            </button>
          </div>
        </div>

        {/* Filters and search bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Quick Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Filtrar por destino, código, veículo ou cliente..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded border border-neutral-800 text-[11px]">
              <span className="text-neutral-400 px-1 font-semibold flex items-center gap-1">
                <Filter className="w-3 h-3 text-red-500" />
                Diferencial:
              </span>
              {['ALL', 'NORMAL', 'CPL', 'CIRCUITO'].map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifferentialFilter(diff)}
                  className={`px-2 py-0.5 rounded font-bold transition-colors ${
                    differentialFilter === diff
                      ? 'bg-red-600 text-white'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                  aria-pressed={differentialFilter === diff}
                >
                  {diff === 'ALL' ? 'Todos' : diff}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setSortBy('value');
                setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 text-xs font-semibold"
              title="Alternar ordenação por valor"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>Ordenar Valor ({sortOrder === 'asc' ? 'Menor' : 'Maior'})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content: Grouped Sections matching Excel Reference */}
      <div className="w-full max-w-7xl mx-auto px-3 py-4 sm:px-5 sm:py-5 space-y-6">
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
            <span className="text-neutral-300">
              Filtro aplicado: <strong className="text-white">{filteredRoutes.length}</strong> de {cityRoutes.length} rotas
              {searchQuery.trim() && <> · busca: <strong className="text-white">{searchQuery}</strong></>}
              {differentialFilter !== 'ALL' && <> · diferencial: <strong className="text-white">{differentialFilter}</strong></>}
            </span>
            <button onClick={clearFilters} className="rounded px-2.5 py-1 font-bold text-red-300 hover:bg-neutral-800 hover:text-white">
              Limpar filtros
            </button>
          </div>
        )}
        {renderPagination()}
        {groupedSections.length === 0 ? (
          <div className="p-12 text-center bg-neutral-900 rounded-lg border border-neutral-800">
            <AlertCircle className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">
              {hasActiveFilters ? 'Nenhuma rota corresponde a esses filtros' : `Nenhuma rota cadastrada para ${currentCityName}`}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mb-4">
              {hasActiveFilters
                ? 'Tente outros termos ou limpe os filtros para ver novamente todas as rotas desta base.'
                : 'A tabela está limpa e pronta para receber novas informações. Você pode importar arquivos PDF com OCR inteligente ou cadastrar rotas manualmente.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold text-xs rounded transition-all">
                  Limpar Filtros
                </button>
              )}
              <button
                onClick={() => onAddNewRoute(currentCityName)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-all shadow"
              >
                + Adicionar Rota Manual
              </button>
              {onOpenImport && (
                <button
                  onClick={onOpenImport}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold text-xs rounded transition-all shadow"
                >
                  Importar PDFs com OCR
                </button>
              )}
            </div>
          </div>
        ) : (
          visibleSections.map(section => (
            <div
              key={section.key}
              className="rounded overflow-hidden border border-neutral-700/80 shadow-xl bg-white"
            >
              {/* Vibrant Red Banner Header */}
              <div className="bg-[#B91C1C] text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-1.5 h-4 bg-white rounded-full opacity-80" />
                  <h2 className="min-w-0 break-words text-sm sm:text-base font-black tracking-wide uppercase font-sans">
                    {section.title}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-black/30 rounded text-[11px] font-mono tracking-wider">
                    {section.records.length} VEÍCULOS
                  </span>
                </div>
              </div>

              {/* 8-Column Data Table */}
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-xs text-neutral-900 text-center border-collapse">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[17%]" />
                    <col className="w-[8%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#0C1E30] text-white font-bold uppercase text-[11px] tracking-wider select-none border-b border-neutral-800">
                      <th className="break-words py-2 px-1 text-left">CLIENTE</th>
                      <th className="break-words py-2 px-1">CIDADE ORIGEM</th>
                      <th className="break-words py-2 px-1">SIGLA ORIGEM</th>
                      <th className="break-words py-2 px-1">CIDADE DESTINO</th>
                      <th className="break-words py-2 px-1">SIGLA DESTINO</th>
                      <th className="break-words py-2 px-1">TIPO</th>
                      <th className="break-words py-2 px-1 text-right">VALOR</th>
                      <th className="break-words py-2 px-1">DIFERENCIAL</th>
                      <th className="break-words py-2 px-1 text-center">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {section.records.map((rec, index) => {
                      const isEven = index % 2 === 1;
                      const hasValue = rec.totalValue !== '-';
                      const isReviewNeeded = rec.reviewStatus === 'AGUARDANDO CONFERÊNCIA';

                      return (
                        <tr
                          key={rec.id}
                          className={`transition-colors hover:bg-red-50/70 ${
                            isEven ? 'bg-[#F8F9FA]' : 'bg-white'
                          } ${isReviewNeeded ? 'border-l-4 border-l-amber-500' : ''}`}
                        >
                          <td className="py-1.5 px-1 text-left font-medium text-neutral-800 break-words">
                            {rec.client}
                          </td>
                          <td className="py-1.5 px-1 font-semibold text-neutral-900 break-words">
                            {rec.originCity}
                          </td>
                          <td className="py-1.5 px-1 font-mono text-neutral-600 font-bold text-[10px] break-normal">
                            {renderCodeParts(rec.originCode)}
                          </td>
                          <td className="py-1.5 px-1 font-semibold text-neutral-900 break-words">
                            {rec.destinationCity}
                          </td>
                          <td className="py-1.5 px-1 font-mono text-neutral-700 font-bold text-[10px] break-normal">
                            {renderCodeParts(rec.destinationCode, true)}
                          </td>
                          <td className="py-1.5 px-1 font-bold text-neutral-900 break-words">
                            {rec.vehicleType}
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono font-black tabular-nums text-[11px]">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                hasValue
                                  ? 'text-neutral-950 font-extrabold bg-neutral-100'
                                  : 'text-neutral-400 font-normal'
                              }`}
                            >
                              {rec.totalValue}
                            </span>
                            {rec.receivableValue != null && rec.hasFreightBreakdown && (
                              <span className="mt-1 block text-[10px] font-semibold text-emerald-700">
                                Valor total recebido: R$ {rec.receivableValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 font-semibold">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] rounded font-bold uppercase tracking-wider ${
                                rec.differential === 'CPL'
                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                  : rec.differential === 'CIRCUITO'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                  : rec.differential === 'NORMAL'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {rec.differential === 'NORMAL' ? 'Normal' : rec.differential}
                            </span>
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isReviewNeeded && (
                                <span
                                  title="Aguardando conferência do OCR"
                                  className="text-amber-600"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <button
                                onClick={() => onEditRecord(rec)}
                                title="Editar registro"
                                className="p-1 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-200 rounded transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteRecord(rec.id)}
                                title="Excluir registro"
                                className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
