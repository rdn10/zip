import React, { useState, useEffect } from 'react';
import { RouteRecord, Differential, ReviewStatus, City } from '../types.js';
import { X, Check, Plus, Edit } from 'lucide-react';

interface EditRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit: RouteRecord | null;
  defaultOriginCity?: string;
  cities: City[];
  onSave: (record: Partial<RouteRecord> & { id?: string }) => void;
}

const VEHICLE_OPTIONS = [
  'BITREM',
  'BITREM 3º',
  'CARRETA CASA',
  'TRUCK CASA',
  'CARRETA AGREGADO',
  'CARRETA 3º',
  'TRUCK 3º',
  'TOCO 3º',
  'TOCO CASA',
  'MÉDIO (3/4 - 3º)',
  'MÉDIO (3/4 - CASA)',
  'VUC 3º',
  'VUC CASA'
];

function parseBrlAmount(value: string): number | null {
  const cleaned = value.replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : null;
}

function formatBrlAmount(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBrlInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  const cents = Number(digits);
  return Number.isFinite(cents)
    ? `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';
}

export const EditRouteModal: React.FC<EditRouteModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  defaultOriginCity = '',
  cities,
  onSave
}) => {
  const [client, setClient] = useState('Mercado Livre');
  const [originCity, setOriginCity] = useState(defaultOriginCity || cities[0]?.name || '');
  const [originCode, setOriginCode] = useState(cities[0]?.codes[0]?.code || '');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationCode, setDestinationCode] = useState('');
  const [vehicleType, setVehicleType] = useState('CARRETA CASA');
  const [customVehicle, setCustomVehicle] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [receivableValue, setReceivableValue] = useState('');
  const [freightWeightValue, setFreightWeightValue] = useState('');
  const [tollValue, setTollValue] = useState('');
  const [differential, setDifferential] = useState<Differential>('NORMAL');

  const routeOriginCity = originCity;
  const routeOriginCode = originCode;
  const cityState = cities.find(city => city.name.trim().toUpperCase() === routeOriginCity.trim().toUpperCase())?.state?.toUpperCase();
  const codeState = routeOriginCode.match(/BR([A-Z]{2})\d{1,2}/i)?.[1]?.toUpperCase();
  const originUnchanged = Boolean(recordToEdit
    && routeOriginCity.trim().toUpperCase() === recordToEdit.originCity.trim().toUpperCase()
    && routeOriginCode.trim().toUpperCase() === recordToEdit.originCode.trim().toUpperCase());
  const originState = (originUnchanged ? recordToEdit?.originState?.toUpperCase() : undefined)
    || (cityState && cityState !== 'BR' ? cityState : undefined)
    || codeState;
  const paymentPercent = recordToEdit?.driverPaymentPercent ?? (originState ? (originState === 'SP' ? 10 : 20) : undefined);

  useEffect(() => {
    if (recordToEdit) {
      setClient(recordToEdit.client);
      setOriginCity(recordToEdit.originCity);
      setOriginCode(recordToEdit.originCode);
      setDestinationCity(recordToEdit.destinationCity);
      setDestinationCode(recordToEdit.destinationCode);
      if (VEHICLE_OPTIONS.includes(recordToEdit.vehicleType)) {
        setVehicleType(recordToEdit.vehicleType);
        setCustomVehicle('');
      } else {
        setVehicleType('CUSTOM');
        setCustomVehicle(recordToEdit.vehicleType);
      }
      let initialFreight = recordToEdit.freightWeightValue ?? null;
      let initialToll = recordToEdit.tollValue ?? null;
      if (recordToEdit.receivableValue != null) {
        if (initialFreight == null && initialToll == null) {
          initialFreight = recordToEdit.receivableValue;
          initialToll = 0;
        } else if (initialFreight == null) {
          initialFreight = Math.max(0, recordToEdit.receivableValue - (initialToll ?? 0));
        } else if (initialToll == null) {
          initialToll = Math.max(0, recordToEdit.receivableValue - initialFreight);
        }
      }
      const received = initialFreight != null || initialToll != null
        ? ((initialFreight ?? 0) * 100 + (initialToll ?? 0) * 100) / 100
        : recordToEdit.receivableValue ?? null;
      setFreightWeightValue(initialFreight == null ? '' : formatBrlAmount(initialFreight));
      setTollValue(initialToll == null ? '' : formatBrlAmount(initialToll));
      setReceivableValue(received == null ? '' : formatBrlAmount(received));
      const isThirdProfile = /3\s*(?:º|°|o)|TERCEIRO/i.test(recordToEdit.vehicleType);
      const calculatedPayment = recordToEdit.hasFreightBreakdown && received != null
        ? isThirdProfile
          ? received
          : paymentPercent != null
            ? Math.floor((Math.round(received * 100) * (100 - paymentPercent) + 50) / 100) / 100
            : null
        : null;
      setTotalValue(calculatedPayment != null ? formatBrlAmount(calculatedPayment) : recordToEdit.totalValue);
      setDifferential(recordToEdit.differential);
    } else {
      setClient('Mercado Livre');
      const initialOrigin = defaultOriginCity || cities[0]?.name || '';
      setOriginCity(initialOrigin);
      const orig = cities.find(c => c.name.toUpperCase() === initialOrigin.toUpperCase());
      setOriginCode(orig?.codes[0]?.code || (initialOrigin ? `BR${initialOrigin.substring(0, 2)}01` : ''));
      setDestinationCity('');
      setDestinationCode('');
      setVehicleType('CARRETA CASA');
      setCustomVehicle('');
      setTotalValue('');
      setReceivableValue('');
      setFreightWeightValue('');
      setTollValue('');
      setDifferential('NORMAL');
    }
  }, [recordToEdit, defaultOriginCity, cities, paymentPercent]);

  // When origin city changes, update origin code
  const handleOriginChange = (cName: string) => {
    setOriginCity(cName);
    const found = cities.find(c => c.name.toUpperCase() === cName.toUpperCase());
    if (found && found.codes.length > 0) {
      setOriginCode(found.codes[0].code);
    } else if (cName) {
      setOriginCode(`BR${cName.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase()}01`);
    }
  };

  // When destination city changes, update destination code
  const handleDestinationChange = (cName: string) => {
    setDestinationCity(cName);
    const found = cities.find(c => c.name.toUpperCase() === cName.toUpperCase());
    if (found && found.codes.length > 0) {
      setDestinationCode(found.codes[0].code);
    } else if (cName) {
      setDestinationCode(`BR${cName.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase()}01`);
    }
  };

  const handleFreightComponentChange = (kind: 'freight' | 'toll', value: string) => {
    const formattedValue = formatBrlInput(value);
    const nextFreight = kind === 'freight' ? formattedValue : freightWeightValue;
    const nextToll = kind === 'toll' ? formattedValue : tollValue;
    setFreightWeightValue(nextFreight);
    setTollValue(nextToll);

    const freightAmount = parseBrlAmount(nextFreight);
    const tollAmount = parseBrlAmount(nextToll);
    if (freightAmount == null && tollAmount == null) {
      setReceivableValue('');
      setTotalValue('-');
      return;
    }

    const receivedCents = Math.round((freightAmount ?? 0) * 100) + Math.round((tollAmount ?? 0) * 100);
    const received = receivedCents / 100;
    setReceivableValue(formatBrlAmount(received));
    const isThirdProfile = /3\s*(?:º|°|o)|TERCEIRO/i.test(recordToEdit?.vehicleType ?? vehicleType);
    if (isThirdProfile) {
      setTotalValue(formatBrlAmount(received));
    } else if (paymentPercent != null) {
      const paymentCents = Math.floor((receivedCents * (100 - paymentPercent) + 50) / 100);
      setTotalValue(formatBrlAmount(paymentCents / 100));
    } else {
      setTotalValue('-');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalVehicle = vehicleType === 'CUSTOM' ? (customVehicle.trim() || 'CARRETA CASA') : vehicleType;
    const freightAmount = parseBrlAmount(freightWeightValue);
    const tollAmount = parseBrlAmount(tollValue);
    const receivedAmount = parseBrlAmount(receivableValue);

    onSave({
      id: recordToEdit?.id,
      client,
      originCity: originCity.toUpperCase().trim(),
      originCode: originCode.toUpperCase().trim(),
      destinationCity: destinationCity.toUpperCase().trim(),
      destinationCode: destinationCode.toUpperCase().trim(),
      vehicleType: finalVehicle,
      totalValue,
      ...(recordToEdit?.hasFreightBreakdown ? {
        freightWeightValue: freightAmount,
        tollValue: tollAmount,
        receivableValue: receivedAmount,
        hasFreightBreakdown: true
      } : {}),
      ...(recordToEdit?.hasFreightBreakdown && originState ? { originState } : {}),
      ...(recordToEdit?.hasFreightBreakdown && paymentPercent != null ? { driverPaymentPercent: paymentPercent as 10 | 20 } : {}),
      differential,
      reviewStatus: 'REVISADO'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-lg">
              {recordToEdit ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                {recordToEdit ? 'EDITAR REGISTRO DE ROTA' : 'ADICIONAR NOVA ROTA'}
              </h2>
              <p className="text-xs text-neutral-400">
                Padrão estrutural de 8 colunas da Monfredini Transportes
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

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={event => {
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              event.target.blur();
            }
          }}
          className="p-6 space-y-4 text-xs"
        >
          <div>
            <label className="block text-neutral-300 font-bold mb-1">Cliente</label>
            <input
              type="text"
              value={client}
              onChange={e => setClient(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-medium focus:outline-none focus:border-red-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-bold mb-1">Cidade Origem</label>
              <input
                type="text"
                list="origin-cities-list"
                placeholder="Ex: SÃO PAULO"
                value={originCity}
                onChange={e => handleOriginChange(e.target.value.toUpperCase())}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:border-red-500"
                required
              />
              <datalist id="origin-cities-list">
                {cities.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-neutral-300 font-bold mb-1">Sigla Origem</label>
              <input
                type="text"
                placeholder="Ex: BRSP01"
                value={originCode}
                onChange={e => setOriginCode(e.target.value.toUpperCase())}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-bold uppercase focus:outline-none focus:border-red-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-bold mb-1">Cidade Destino</label>
              <input
                type="text"
                list="dest-cities-list"
                placeholder="Ex: CAMPINAS"
                value={destinationCity}
                onChange={e => handleDestinationChange(e.target.value.toUpperCase())}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:border-red-500"
                required
              />
              <datalist id="dest-cities-list">
                {cities.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-neutral-300 font-bold mb-1">Sigla Destino</label>
              <input
                type="text"
                placeholder="Ex: BRSP02"
                value={destinationCode}
                onChange={e => setDestinationCode(e.target.value.toUpperCase())}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-bold uppercase focus:outline-none focus:border-red-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-bold mb-1">Perfil do Veículo (Tipo)</label>
            <select
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold focus:outline-none focus:border-red-500"
            >
              {VEHICLE_OPTIONS.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
              <option value="CUSTOM">Outro Perfil (Digitar Manuscrito)</option>
            </select>

            {vehicleType === 'CUSTOM' && (
              <input
                type="text"
                placeholder="Digite a descrição exata do perfil..."
                value={customVehicle}
                onChange={e => setCustomVehicle(e.target.value)}
                className="w-full mt-2 bg-neutral-950 border border-red-500 rounded px-3 py-1.5 text-white font-bold uppercase focus:outline-none"
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {recordToEdit?.hasFreightBreakdown && (
              <>
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">Frete peso (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={freightWeightValue}
                    onChange={e => handleFreightComponentChange('freight', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-extrabold focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">Pedágio (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={tollValue}
                    onChange={e => handleFreightComponentChange('toll', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-extrabold focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">Valor total recebido (R$)</label>
                  <div className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono font-extrabold text-white">
                    {receivableValue || 'Preencha frete peso e pedágio'}
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-500">Soma automática do frete peso com o pedágio.</p>
                </div>
              </>
            )}

            <div>
                <label className="block text-neutral-300 font-bold mb-1">Valor Total{recordToEdit?.hasFreightBreakdown ? ' (Pagamento motorista)' : ''}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="R$ 1.000,00 ou -"
                value={totalValue}
                onChange={e => setTotalValue(e.target.value.trim() === '-' ? '-' : formatBrlInput(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-mono font-extrabold focus:outline-none focus:border-red-500"
                required
              />
              {recordToEdit?.hasFreightBreakdown && (
                <p className="mt-1 text-[10px] text-neutral-500">
                  {paymentPercent != null
                    ? `Calculado com desconto de ${paymentPercent}% sobre o total recebido.`
                    : 'Não foi possível identificar a UF de origem para calcular o desconto.'}
                </p>
              )}
            </div>

            <div className={recordToEdit?.hasFreightBreakdown ? 'col-span-2' : ''}>
              <label className="block text-neutral-300 font-bold mb-1">Diferencial</label>
              <select
                value={differential}
                onChange={e => setDifferential(e.target.value as Differential)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white font-bold focus:outline-none focus:border-red-500"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="CPL">CPL</option>
                <option value="CIRCUITO">CIRCUITO</option>
                <option value="-">-</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-semibold text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs shadow-md transition-all"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
