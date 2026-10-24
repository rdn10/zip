import React, { useState, useMemo } from 'react';
import { Building2, Plus, X, Trash2, Check, Tag, Search, MapPin, AlertTriangle, ArrowRight } from 'lucide-react';
import { City } from '../types.js';

interface CitiesManagerProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  onAddCity: (name: string, state: string, codes: string[]) => void;
  onUpdateCity: (id: string, updates: Partial<City>) => void;
  onDeleteCity: (id: string) => void;
  onSelectCity: (cityName: string) => void;
}

export const CitiesManager: React.FC<CitiesManagerProps> = ({
  isOpen,
  onClose,
  cities,
  onAddCity,
  onUpdateCity,
  onDeleteCity,
  onSelectCity
}) => {
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('');
  const [newCityCode, setNewCityCode] = useState('');
  const [addingCodeForCityId, setAddingCodeForCityId] = useState<string | null>(null);
  const [newExtraCode, setNewExtraCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('TODOS');

  // Available unique states
  const availableStates = useMemo(() => {
    const set = new Set(cities.map(c => c.state).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [cities]);

  // Filtered cities list
  const filteredCities = useMemo(() => {
    return cities.filter(city => {
      const matchesState = selectedState === 'TODOS' || city.state === selectedState;
      if (!matchesState) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const nameMatches = city.name.toLowerCase().includes(term);
      const stateMatches = city.state.toLowerCase().includes(term);
      const codeMatches = city.codes.some(c => c.code.toLowerCase().includes(term));
      const addressMatches = city.address ? city.address.toLowerCase().includes(term) : false;
      const restrictionMatches = city.restrictions ? city.restrictions.toLowerCase().includes(term) : false;

      return nameMatches || stateMatches || codeMatches || addressMatches || restrictionMatches;
    });
  }, [cities, searchTerm, selectedState]);

  if (!isOpen) return null;

  const handleCreateCity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    const codes = newCityCode.trim() ? [newCityCode.trim().toUpperCase()] : [];
    onAddCity(newCityName.trim().toUpperCase(), newCityState.trim().toUpperCase() || 'BR', codes);
    setNewCityName('');
    setNewCityState('');
    setNewCityCode('');
  };

  const handleAddCodeToCity = (city: City) => {
    if (!newExtraCode.trim()) return;
    const cleanCode = newExtraCode.trim().toUpperCase();
    if (city.codes.some(c => c.code === cleanCode)) return;

    const updatedCodes = [
      ...city.codes,
      { id: `c-${Date.now()}`, code: cleanCode, active: true }
    ];
    onUpdateCity(city.id, { codes: updatedCodes });
    setNewExtraCode('');
    setAddingCodeForCityId(null);
  };

  const handleRemoveCode = (city: City, codeId: string) => {
    const updatedCodes = city.codes.filter(c => c.id !== codeId);
    onUpdateCity(city.id, { codes: updatedCodes });
  };

  const handleToggleCodeActive = (city: City, codeId: string) => {
    const updatedCodes = city.codes.map(c =>
      c.id === codeId ? { ...c, active: !c.active } : c
    );
    onUpdateCity(city.id, { codes: updatedCodes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                CADASTRO DE CIDADES E CÓDIGOS OPERACIONAIS
              </h2>
              <p className="text-xs text-neutral-400">
                Gerencie siglas e múltiplos códigos de destino usados na expansão automática
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Form to add new city */}
          <form
            onSubmit={handleCreateCity}
            className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3"
          >
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-red-500" /> CADASTRAR NOVA CIDADE
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-5">
                <label className="block text-neutral-400 mb-1">Nome da Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: RESENDE"
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-neutral-400 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  placeholder="Ex: RJ"
                  maxLength={2}
                  value={newCityState}
                  onChange={e => setNewCityState(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:border-red-500 text-center"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-neutral-400 mb-1">Código Operacional Inicial</label>
                <input
                  type="text"
                  placeholder="Ex: BRRJ05"
                  value={newCityCode}
                  onChange={e => setNewCityCode(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-bold uppercase focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-all shadow"
                >
                  Cadastrar
                </button>
              </div>
            </div>
          </form>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cidade, código (ex: BRSP01, SSP1), estado ou endereço..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] text-neutral-400 whitespace-nowrap">UF:</span>
              <select
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-500 font-bold"
              >
                {availableStates.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Existing Cities List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                BASES E CIDADES CADASTRADAS ({filteredCities.length} de {cities.length})
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                Padrão Oficial Mercado Livre Ativo
              </span>
            </div>

            {filteredCities.length === 0 ? (
              <div className="p-8 text-center bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-400 text-xs">
                Nenhuma base encontrada para os filtros aplicados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredCities.map(city => (
                  <div
                    key={city.id}
                    className="p-3.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-lg space-y-2.5 text-xs transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-black text-sm text-white uppercase font-sans">
                            {city.name}
                          </span>
                          <button
                            onClick={() => onSelectCity(city.name)}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-red-900/70 bg-red-950/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-300 transition-colors hover:border-red-600 hover:bg-red-900/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            title={`Ver informações e rotas relacionadas a ${city.name}`}
                          >
                            Ver informações da base <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[11px] font-bold">
                          {city.state}
                        </span>
                        {city.restrictions && (
                          <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800 text-amber-300 rounded text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            {city.restrictions}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onUpdateCity(city.id, { active: !city.active })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                            city.active
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-neutral-800 text-neutral-500'
                          }`}
                        >
                          {city.active ? 'Ativa' : 'Inativa'}
                        </button>

                        <button
                          onClick={() => onDeleteCity(city.id)}
                          className="p-1 text-neutral-500 hover:text-red-400"
                          title="Excluir cidade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Operational Codes Chips */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold flex items-center gap-1">
                        <Tag className="w-3 h-3 text-red-500" /> Códigos ({city.codes.length}):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {city.codes.map(codeObj => (
                          <div
                            key={codeObj.id}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                              codeObj.active
                                ? 'bg-neutral-900 border-neutral-700 text-neutral-100'
                                : 'bg-neutral-900/40 border-neutral-800 text-neutral-500 line-through'
                            }`}
                          >
                            <span
                              onClick={() => handleToggleCodeActive(city, codeObj.id)}
                              className="cursor-pointer"
                              title="Clique para ativar/desativar código"
                            >
                              {codeObj.code}
                            </span>
                            <button
                              onClick={() => handleRemoveCode(city, codeObj.id)}
                              className="text-neutral-500 hover:text-red-400 ml-1"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}

                        {addingCodeForCityId === city.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="NOVO CÓD."
                              value={newExtraCode}
                              onChange={e => setNewExtraCode(e.target.value)}
                              className="w-24 bg-neutral-900 border border-red-500 rounded px-1.5 py-0.5 text-[11px] font-mono text-white uppercase focus:outline-none"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleAddCodeToCity(city);
                                if (e.key === 'Escape') setAddingCodeForCityId(null);
                              }}
                            />
                            <button
                              onClick={() => handleAddCodeToCity(city)}
                              className="p-1 bg-red-600 text-white rounded text-[10px]"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setAddingCodeForCityId(null)}
                              className="p-1 text-neutral-500 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingCodeForCityId(city.id);
                              setNewExtraCode('');
                            }}
                            className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-dashed border-neutral-700 text-neutral-400 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-2.5 h-2.5" /> Adicionar Código
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Address & CNPJ Info */}
                    {city.address && (
                      <div className="pt-1 border-t border-neutral-900 flex items-start gap-1.5 text-[11px] text-neutral-400">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{city.address}</span>
                      </div>
                    )}
                    {city.cnpj && (
                      <div className="text-[10px] text-neutral-500 font-mono">
                        CNPJ: {city.cnpj}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-semibold text-xs"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
