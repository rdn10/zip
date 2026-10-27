import React, { useState } from 'react';
import {
  ClipboardCheck,
  Check,
  X,
  AlertCircle,
  Edit2,
  Trash2,
  CheckCheck,
  Search,
  Filter,
  FileText,
  Plus
} from 'lucide-react';
import { RouteRecord, ReviewStatus, Differential } from '../types.js';

function parseBrlAmount(value: string): number | null {
  const cleaned = value.replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

function formatBrlAmount(value: number | null): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBrlInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return '';
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const VEHICLE_TYPE_OPTIONS = [
  'BITREM', 'BITREM 3º', 'CARRETA CASA', 'TRUCK CASA', 'CARRETA AGREGADO',
  'CARRETA 3º', 'TRUCK 3º', 'TOCO CASA', 'TOCO 3º', 'MÉDIO (3/4 - CASA)',
  'MÉDIO (3/4 - 3º)', 'VUC CASA', 'VUC 3º'
];

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RouteRecord[];
  onUpdateRecord: (id: string, updates: Partial<RouteRecord>) => void | boolean | Promise<void | boolean>;
  onAddRecord: (record: Partial<RouteRecord>) => Promise<RouteRecord | null>;
  onDeleteRecord: (id: string) => void;
  onBatchDelete: (ids: string[]) => void;
  onBatchApprove: (ids: string[], updates?: Array<{ id: string; updates: Partial<RouteRecord> }>) => void | boolean | Promise<void | boolean>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  records,
  onUpdateRecord,
  onAddRecord,
  onDeleteRecord,
  onBatchDelete,
  onBatchApprove
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [checkedRecordIds, setCheckedRecordIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('AGUARDANDO CONFERÊNCIA');
  const [search, setSearch] = useState('');

  // Editing state for selected record
  const [editClient, setEditClient] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editOriginCode, setEditOriginCode] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editDestinationCode, setEditDestinationCode] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editTotalValue, setEditTotalValue] = useState('');
  const [editFreightWeightValue, setEditFreightWeightValue] = useState('');
  const [editTollValue, setEditTollValue] = useState('');
  const [editReceivableValue, setEditReceivableValue] = useState('');
  const [editDifferential, setEditDifferential] = useState<Differential>('NORMAL');
  const [editStatus, setEditStatus] = useState<ReviewStatus>('REVISADO');
  const [appliedDraft, setAppliedDraft] = useState<Partial<RouteRecord> | null>(null);
  const [draftTotalValues, setDraftTotalValues] = useState<Record<string, string>>({});
  const [draftBreakdownValues, setDraftBreakdownValues] = useState<Record<string, Partial<RouteRecord>>>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [saveError, setSaveError] = useState('');
  const skipNextRecordSyncId = React.useRef<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehicleValue, setNewVehicleValue] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addVehicleError, setAddVehicleError] = useState('');

  // Filter records
  const filteredRecords = records.filter(r => {
    if (filterStatus !== 'ALL' && r.reviewStatus !== filterStatus) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        r.originCity.toLowerCase().includes(q) ||
        r.destinationCity.toLowerCase().includes(q) ||
        r.vehicleType.toLowerCase().includes(q) ||
        r.documentName.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const filteredRecordGroups = Array.from(filteredRecords.reduce((groups, record) => {
    const key = record.documentId || record.documentName;
    const group = groups.get(key) || { key, documentName: record.documentName, records: [] as RouteRecord[] };
    group.records.push(record);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; documentName: string; records: RouteRecord[] }>()).values());

  const selectedRecord = records.find(r => r.id === selectedRecordId) || filteredRecords[0] || null;
  const filteredIds = filteredRecords.map(record => record.id);
  const visibleCheckedRecordIds = filteredIds.filter(id => checkedRecordIds.includes(id));
  const allFilteredChecked = filteredIds.length > 0 && visibleCheckedRecordIds.length === filteredIds.length;

  const toggleAllFiltered = () => {
    setCheckedRecordIds(current => allFilteredChecked
      ? current.filter(id => !filteredIds.includes(id))
      : Array.from(new Set([...current, ...filteredIds]))
    );
  };

  const toggleGroupChecked = (groupIds: string[]) => {
    const groupIsFullyChecked = groupIds.length > 0 && groupIds.every(id => checkedRecordIds.includes(id));
    setCheckedRecordIds(current => groupIsFullyChecked
      ? current.filter(id => !groupIds.includes(id))
      : Array.from(new Set([...current, ...groupIds]))
    );
  };

  const toggleRecordChecked = (id: string) => {
    setCheckedRecordIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  // When selected record changes, sync edit form
  React.useEffect(() => {
    if (selectedRecord) {
      if (skipNextRecordSyncId.current === selectedRecord.id) {
        skipNextRecordSyncId.current = null;
        return;
      }
      skipNextRecordSyncId.current = null;
      setSaveError('');
      setSelectedRecordId(selectedRecord.id);
      setEditClient(selectedRecord.client);
      setEditOrigin(selectedRecord.originCity);
      setEditOriginCode(selectedRecord.originCode);
      setEditDestination(selectedRecord.destinationCity);
      setEditDestinationCode(selectedRecord.destinationCode);
      setEditVehicleType(selectedRecord.vehicleType);
      const breakdownDraft = draftBreakdownValues[selectedRecord.id];
      const savedDraftTotal = draftTotalValues[selectedRecord.id]
        ?? (typeof breakdownDraft?.totalValue === 'string' ? breakdownDraft.totalValue : undefined);
      setEditTotalValue(savedDraftTotal ?? (
        selectedRecord.hasFreightBreakdown && selectedRecord.driverPaymentValue != null
          ? `R$ ${selectedRecord.driverPaymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : selectedRecord.totalValue
      ));
      const savedBreakdown = breakdownDraft;
      const displayMoney = (value: number | null | undefined) => value == null
        ? ''
        : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setEditReceivableValue(savedBreakdown?.receivableValue !== undefined
        ? displayMoney(savedBreakdown.receivableValue)
        : selectedRecord.receivableValue == null
        ? ''
        : `R$ ${selectedRecord.receivableValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setEditFreightWeightValue(savedBreakdown?.freightWeightValue !== undefined
        ? displayMoney(savedBreakdown.freightWeightValue)
        : selectedRecord.freightWeightValue == null
        ? ''
        : `R$ ${selectedRecord.freightWeightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setEditTollValue(savedBreakdown?.tollValue !== undefined
        ? displayMoney(savedBreakdown.tollValue)
        : selectedRecord.tollValue == null
        ? ''
        : `R$ ${selectedRecord.tollValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setEditDifferential(selectedRecord.differential);
      setEditStatus(selectedRecord.reviewStatus);
      setAppliedDraft({
        client: selectedRecord.client,
        originCity: selectedRecord.originCity,
        originCode: selectedRecord.originCode,
        destinationCity: selectedRecord.destinationCity,
        destinationCode: selectedRecord.destinationCode,
        vehicleType: selectedRecord.vehicleType,
        totalValue: savedDraftTotal ?? (selectedRecord.hasFreightBreakdown && selectedRecord.driverPaymentValue != null
          ? formatBrlAmount(selectedRecord.driverPaymentValue)
          : selectedRecord.totalValue),
        differential: selectedRecord.differential
      });
    }
  }, [selectedRecord]);

  React.useEffect(() => {
    const recordIds = new Set(records.map(record => record.id));
    setCheckedRecordIds(current => current.filter(id => recordIds.has(id)));
  }, [records]);

  React.useEffect(() => {
    setCheckedRecordIds([]);
  }, [filterStatus, search]);

  const handleSaveSelected = async (overrides: Partial<RouteRecord> = {}) => {
    if (!selectedRecord || savingRecord) return;
    const totalValue = typeof overrides.totalValue === 'string' ? overrides.totalValue : editTotalValue;
    const parsedTotalValue = parseBrlAmount(totalValue);
    const freightWeight = parseBrlAmount(editFreightWeightValue);
    const toll = parseBrlAmount(editTollValue);
    const manualReceivable = freightWeight != null && toll != null
      ? (Math.round(freightWeight * 100) + Math.round(toll * 100)) / 100
      : parseBrlAmount(editReceivableValue);
    const existingPaymentCents = selectedRecord.driverPaymentValue == null
      ? null
      : Math.round(selectedRecord.driverPaymentValue * 100);
    const enteredPaymentCents = parsedTotalValue == null ? null : Math.round(parsedTotalValue * 100);
    const manualDriverPayment = selectedRecord.hasFreightBreakdown && existingPaymentCents !== enteredPaymentCents;
    setSavingRecord(true);
    setSaveError('');
    try {
      const saved = await onUpdateRecord(selectedRecord.id, {
        client: editClient,
        originCity: editOrigin.toUpperCase().trim(),
        originCode: editOriginCode.toUpperCase().trim(),
        destinationCity: editDestination.toUpperCase().trim(),
        destinationCode: editDestinationCode.toUpperCase().trim(),
        vehicleType: editVehicleType,
        totalValue,
        ...(selectedRecord.hasFreightBreakdown ? {
          freightWeightValue: freightWeight,
          tollValue: toll,
          receivableValue: manualReceivable,
          hasFreightBreakdown: true,
          ...(manualDriverPayment ? { driverPaymentValue: parsedTotalValue } : {})
        } : {}),
        differential: editDifferential,
        reviewStatus: 'REVISADO',
        ...overrides
      });
      if (saved === false) setSaveError('Não foi possível salvar. Confira a conexão e tente novamente.');
      else {
        setDraftTotalValues(current => {
          const next = { ...current };
          delete next[selectedRecord.id];
          return next;
        });
        setDraftBreakdownValues(current => {
          const next = { ...current };
          delete next[selectedRecord.id];
          return next;
        });
      }
    } catch {
      setSaveError('Erro ao salvar. Confira a conexão e tente novamente.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDifferentialChange = async (differential: Differential) => {
    setEditDifferential(differential);
    if (!selectedRecord || selectedRecord.differential === differential || savingRecord) return;

    setSavingRecord(true);
    setSaveError('');
    skipNextRecordSyncId.current = selectedRecord.id;
    try {
      const saved = await onUpdateRecord(selectedRecord.id, { differential });
      if (saved === false) {
        skipNextRecordSyncId.current = null;
        setSaveError('Não foi possível salvar o diferencial. Confira a conexão e tente novamente.');
      }
    } catch {
      skipNextRecordSyncId.current = null;
      setSaveError('Erro ao salvar o diferencial. Confira a conexão e tente novamente.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleApproveAllPending = () => {
    const pendingIds = records
      .filter(r => r.reviewStatus === 'AGUARDANDO CONFERÊNCIA')
      .map(r => r.id);
    if (pendingIds.length > 0) {
      void handleApproveRecords(pendingIds);
    }
  };

  const handleApproveRecords = async (ids: string[]) => {
    if (ids.length === 0 || savingRecord) return;
    const updates = ids.flatMap(id => {
      const totalValue = draftTotalValues[id];
      const record = records.find(item => item.id === id);
      if (!record) return [];
      const breakdown = draftBreakdownValues[id];
      if (totalValue === undefined && !breakdown) return [];
      const amount = parseBrlAmount(totalValue ?? String(breakdown?.totalValue ?? ''));
      const normalizedValue = amount == null ? (totalValue ?? String(breakdown?.totalValue ?? '-')) : formatBrlAmount(amount);
      return [{
        id,
        updates: {
          totalValue: normalizedValue,
          ...(record.hasFreightBreakdown ? {
            ...(breakdown || totalValue !== undefined ? {
              freightWeightValue: breakdown?.freightWeightValue !== undefined ? breakdown.freightWeightValue : record.freightWeightValue,
              tollValue: breakdown?.tollValue !== undefined ? breakdown.tollValue : record.tollValue,
              receivableValue: breakdown?.receivableValue !== undefined ? breakdown.receivableValue : record.receivableValue,
              driverPaymentValue: totalValue !== undefined ? amount : breakdown?.driverPaymentValue ?? null,
              hasFreightBreakdown: true
            } : { driverPaymentValue: amount })
          } : {})
        }
      }];
    });

    setSavingRecord(true);
    setSaveError('');
    try {
      const approved = await onBatchApprove(ids, updates);
      if (approved === false) {
        setSaveError('Não foi possível aprovar as rotas. Confira a conexão e tente novamente.');
        return;
      }
      setDraftTotalValues(current => {
        const next = { ...current };
        ids.forEach(id => delete next[id]);
        return next;
      });
      setDraftBreakdownValues(current => {
        const next = { ...current };
        ids.forEach(id => delete next[id]);
        return next;
      });
      setAppliedDraft(null);
    } catch {
      setSaveError('Erro ao aprovar as rotas. Confira a conexão e tente novamente.');
    } finally {
      setSavingRecord(false);
    }
  };

  const freightWeight = parseBrlAmount(editFreightWeightValue);
  const toll = parseBrlAmount(editTollValue);
  const manualReceivable = freightWeight != null && toll != null
    ? (Math.round(freightWeight * 100) + Math.round(toll * 100)) / 100
    : parseBrlAmount(editReceivableValue);
  const paymentPercent = selectedRecord?.driverPaymentPercent
    ?? (selectedRecord?.originState?.toUpperCase() === 'SP' ? 10 : selectedRecord?.originState ? 20 : undefined);
  const calculatedDriverPayment = manualReceivable != null && paymentPercent != null
    ? Math.floor((Math.round(manualReceivable * 100) * (100 - paymentPercent) + 50) / 100) / 100
    : null;
  const calculationRuleMessage = paymentPercent == null
    ? 'Cálculo: origem SP aplica 10% de desconto (pagamento de 90%); outras UFs aplicam 20% (pagamento de 80%). A UF desta rota ainda não foi identificada.'
    : `Cálculo: origem SP aplica 10% de desconto (pagamento de 90%); outras UFs aplicam 20% (pagamento de 80%). Nesta rota, está aplicado o desconto de ${paymentPercent}%.`;

  const handleReceivableChange = (value: string) => {
    const formattedValue = formatBrlInput(value);
    setEditReceivableValue(formattedValue);
    const amount = parseBrlAmount(formattedValue);
    const paymentCents = amount != null && paymentPercent != null
      ? Math.floor((Math.round(amount * 100) * (100 - paymentPercent) + 50) / 100)
      : null;
    const paymentValue = paymentCents == null ? null : paymentCents / 100;
    const paymentDisplay = paymentValue == null ? '-' : formatBrlAmount(paymentValue);
    applyCurrentDraft({ totalValue: paymentDisplay });
    if (selectedRecord) {
      setDraftTotalValues(current => {
        const next = { ...current };
        delete next[selectedRecord.id];
        return next;
      });
      setDraftBreakdownValues(current => ({
        ...current,
        [selectedRecord.id]: {
          ...current[selectedRecord.id],
          receivableValue: amount,
          driverPaymentValue: paymentValue,
          totalValue: paymentDisplay
        }
      }));
    }
    if (amount == null) {
      if (!value.trim()) setEditTotalValue('-');
      return;
    }
    if (paymentPercent == null) return;
    setEditTotalValue(formatBrlAmount(paymentCents / 100));
  };

  const handleEditTotalValueChange = (value: string) => {
    setEditTotalValue(value.trim() === '-' ? '-' : formatBrlInput(value));
  };

  const handleNewVehicleValueChange = (value: string) => {
    setNewVehicleValue(value.trim() === '-' ? '-' : formatBrlInput(value));
  };

  const handleFreightBreakdownChange = (kind: 'freight' | 'toll', value: string) => {
    const formattedValue = formatBrlInput(value);
    const nextFreight = kind === 'freight' ? formattedValue : editFreightWeightValue;
    const nextToll = kind === 'toll' ? formattedValue : editTollValue;
    setEditFreightWeightValue(nextFreight);
    setEditTollValue(nextToll);

    const parsedFreight = parseBrlAmount(nextFreight);
    const parsedToll = parseBrlAmount(nextToll);
    const receivedCents = parsedFreight != null && parsedToll != null
      ? Math.round(parsedFreight * 100) + Math.round(parsedToll * 100)
      : null;
    const received = receivedCents == null ? null : receivedCents / 100;
    const paymentCents = receivedCents != null && paymentPercent != null
      ? Math.floor((receivedCents * (100 - paymentPercent) + 50) / 100)
      : null;
    const paymentValue = paymentCents == null ? null : paymentCents / 100;
    const paymentDisplay = paymentValue == null ? '-' : formatBrlAmount(paymentValue);
    applyCurrentDraft({ totalValue: paymentDisplay });
    if (selectedRecord) {
      setDraftTotalValues(current => {
        const next = { ...current };
        delete next[selectedRecord.id];
        return next;
      });
      setDraftBreakdownValues(current => ({
        ...current,
        [selectedRecord.id]: {
          ...current[selectedRecord.id],
          freightWeightValue: parsedFreight,
          tollValue: parsedToll,
          receivableValue: received,
          driverPaymentValue: paymentValue,
          totalValue: paymentDisplay
        }
      }));
    }
    if (parsedFreight == null || parsedToll == null) {
      setEditReceivableValue('');
      setEditTotalValue('-');
      return;
    }

    setEditReceivableValue(formatBrlAmount(received));
    if (paymentPercent == null) return;
    setEditTotalValue(paymentDisplay);
  };

  const handleTotalValueKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const amount = parseBrlAmount(editTotalValue);
    const appliedValue = amount != null ? formatBrlAmount(amount) : editTotalValue;
    if (amount != null) setEditTotalValue(appliedValue);
    applyCurrentDraft({ totalValue: appliedValue });
    if (selectedRecord) {
      setDraftTotalValues(current => ({ ...current, [selectedRecord.id]: appliedValue }));
    }
    event.currentTarget.blur();
  };

  const applyCurrentDraft = (overrides: Partial<RouteRecord> = {}) => {
    setAppliedDraft({
      client: editClient,
      originCity: editOrigin.toUpperCase().trim(),
      originCode: editOriginCode.toUpperCase().trim(),
      destinationCity: editDestination.toUpperCase().trim(),
      destinationCode: editDestinationCode.toUpperCase().trim(),
      vehicleType: editVehicleType,
      totalValue: editTotalValue,
      differential: editDifferential,
      ...overrides
    });
  };

  const handleDraftFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyCurrentDraft();
    event.currentTarget.blur();
  };

  const handleSimpleEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.blur();
  };

  const handleAddVehicleRecord = async () => {
    if (!selectedRecord || !newVehicleType.trim()) {
      setAddVehicleError('Informe o tipo de veículo.');
      return;
    }
    setAddingVehicle(true);
    setAddVehicleError('');
    try {
      const created = await onAddRecord({
        documentId: selectedRecord.documentId,
        documentPageId: selectedRecord.documentPageId,
        documentName: selectedRecord.documentName,
        pageNumber: selectedRecord.pageNumber,
        client: selectedRecord.client,
        originCity: selectedRecord.originCity,
        originState: selectedRecord.originState,
        originCode: selectedRecord.originCode,
        destinationCity: selectedRecord.destinationCity,
        destinationCode: selectedRecord.destinationCode,
        vehicleType: newVehicleType.trim().toUpperCase(),
        totalValue: newVehicleValue.trim() || '-',
        // CASA profiles use the freight-weight + toll calculator, including
        // vehicle types added manually during OCR review (such as VUC CASA).
        hasFreightBreakdown: /\bCASA\b/i.test(newVehicleType),
        differential: selectedRecord.differential,
        reviewStatus: 'AGUARDANDO CONFERÊNCIA',
        ocrConfidence: 0,
        notes: 'Tipo de veículo adicionado manualmente durante a conferência do OCR.'
      });
      if (!created) {
        setAddVehicleError('Não foi possível adicionar o tipo. Tente novamente.');
        return;
      }
      setFilterStatus('AGUARDANDO CONFERÊNCIA');
      setSearch('');
      setSelectedRecordId(created.id);
      setNewVehicleType('');
      setNewVehicleValue('');
      setShowAddVehicle(false);
    } catch {
      setAddVehicleError('Erro ao adicionar o tipo de veículo.');
    } finally {
      setAddingVehicle(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[92vh] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                CONFERÊNCIA E REVISÃO DE OCR
              </h2>
              <p className="text-xs text-neutral-400">
                Auditoria de confiança, valores manuscritos e confirmação de rotas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleApproveAllPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all shadow"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Aprovar Todos Pendentes</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and search strip */}
        <div className="px-6 py-3 bg-neutral-900/90 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-medium">Filtrar Status:</span>
            {['ALL', 'AGUARDANDO CONFERÊNCIA', 'REVISADO', 'PROCESSADO'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  filterStatus === st
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'Todos' : st}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar registro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded pl-9 pr-3 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* 2-Column Split: Left = List of records, Right = Details & Correction */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Records list */}
          <div className="md:col-span-6 border-r border-neutral-800 overflow-y-auto bg-neutral-950/40">
            {filteredRecords.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-2 text-neutral-300">
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    onChange={toggleAllFiltered}
                    className="h-4 w-4 accent-red-600"
                    aria-label="Selecionar todos os registros filtrados"
                  />
                  Selecionar todos ({filteredRecords.length})
                </label>
                <button
                  onClick={() => { void handleApproveRecords(visibleCheckedRecordIds); }}
                  disabled={visibleCheckedRecordIds.length === 0 || savingRecord}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-2.5 py-1.5 font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Aprovar selecionados ({visibleCheckedRecordIds.length})
                </button>
                <button
                  onClick={() => onBatchDelete(visibleCheckedRecordIds)}
                  disabled={visibleCheckedRecordIds.length === 0}
                  className="inline-flex items-center gap-1.5 rounded bg-red-700 px-2.5 py-1.5 font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir selecionados ({visibleCheckedRecordIds.length})
                </button>
              </div>
            )}
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Nenhum registro encontrado para este filtro.
              </div>
            ) : (
              filteredRecordGroups.map((group, groupIndex) => (
                <section key={group.key}>
                  <div className="border-y-2 border-amber-400/70 border-l-4 border-l-amber-400 bg-amber-950/65 px-3 py-3 sm:px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 sm:text-xs">
                          ↓ A PARTIR DAQUI, ROTAS:
                        </p>
                        <p className="truncate text-sm font-black uppercase leading-tight text-white sm:text-base">
                          {Array.from(new Set(group.records.map(record => `${record.originCity} × ${record.destinationCity}`))).join(' · ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="rounded bg-neutral-900/80 px-2.5 py-1 text-[10px] font-bold text-neutral-200 sm:text-xs">
                          {group.records.length} {group.records.length === 1 ? 'rota' : 'rotas'}
                        </span>
                        <label
                          className="flex cursor-pointer items-center gap-1.5 rounded border border-amber-700/70 bg-neutral-950/70 px-2 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-900/50"
                          title="Selecionar ou desmarcar todas as revisões deste título"
                        >
                          <input
                            type="checkbox"
                            checked={group.records.length > 0 && group.records.every(record => checkedRecordIds.includes(record.id))}
                            onClick={event => event.stopPropagation()}
                            onChange={() => toggleGroupChecked(group.records.map(record => record.id))}
                            className="h-3.5 w-3.5 accent-amber-500"
                            aria-label={`Selecionar todas as revisões de ${Array.from(new Set(group.records.map(record => `${record.originCity} para ${record.destinationCity}`))).join(', ')}`}
                          />
                          Selecionar este título
                        </label>
                      </div>
                    </div>
                    <div className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-amber-700/50 pt-2 text-[10px] font-semibold text-amber-100 sm:text-[11px]">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="shrink-0 uppercase tracking-wide">PDF {groupIndex + 1}</span>
                      <span className="text-amber-500/70">·</span>
                      <span className="truncate">{group.documentName}</span>
                    </div>
                  </div>
                  {group.records.map(rec => {
                    const isSelected = selectedRecord?.id === rec.id;
                    const isPending = rec.reviewStatus === 'AGUARDANDO CONFERÊNCIA';
                    const shownOrigin = isSelected ? appliedDraft?.originCity ?? rec.originCity : rec.originCity;
                    const shownDestination = isSelected ? appliedDraft?.destinationCity ?? rec.destinationCity : rec.destinationCity;
                    const shownVehicleType = isSelected ? appliedDraft?.vehicleType ?? rec.vehicleType : rec.vehicleType;
                    const shownTotalValue = isSelected
                      ? appliedDraft?.totalValue ?? draftTotalValues[rec.id] ?? draftBreakdownValues[rec.id]?.totalValue ?? rec.totalValue
                      : draftTotalValues[rec.id] ?? draftBreakdownValues[rec.id]?.totalValue ?? rec.totalValue;

                    return (
                      <div
                        key={rec.id}
                        onClick={() => setSelectedRecordId(rec.id)}
                        className={`border-b border-neutral-800/80 p-3.5 cursor-pointer transition-colors flex items-start justify-between gap-3 text-xs ${
                          isSelected
                            ? 'bg-neutral-800/90 border-l-4 border-l-red-600'
                            : isPending
                            ? 'hover:bg-neutral-900 border-l-4 border-l-amber-500'
                            : 'hover:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={checkedRecordIds.includes(rec.id)}
                            onClick={event => event.stopPropagation()}
                            onChange={() => toggleRecordChecked(rec.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                            aria-label={`Selecionar rota ${rec.originCity} para ${rec.destinationCity}, ${rec.vehicleType}`}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white uppercase">
                                {shownOrigin} → {shownDestination}
                              </span>
                              <span className="px-1.5 py-0.2 bg-neutral-800 text-neutral-300 font-mono text-[10px] rounded font-bold">
                                {rec.destinationCode}
                              </span>
                              {rec.differential !== 'NORMAL' && rec.differential !== '-' && (
                                <span className="px-1.5 py-0.2 bg-red-950 text-red-400 border border-red-800 text-[10px] rounded font-bold">
                                  {rec.differential}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                              <span className="font-semibold text-neutral-200">{shownVehicleType}</span>
                              <span>·</span>
                              <span className="font-mono text-white font-bold">{shownTotalValue}</span>
                            </div>

                            <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                              <FileText className="w-3 h-3 text-neutral-400" />
                              {rec.documentName} (Pág. {rec.pageNumber})
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              rec.ocrConfidence >= 90
                                ? 'bg-emerald-950 text-emerald-400'
                                : rec.ocrConfidence >= 80
                                ? 'bg-amber-950 text-amber-400'
                                : 'bg-red-950 text-red-400'
                            }`}
                          >
                            {rec.ocrConfidence}% OCR
                          </span>

                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              rec.reviewStatus === 'REVISADO'
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : rec.reviewStatus === 'AGUARDANDO CONFERÊNCIA'
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {rec.reviewStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>

          {/* Right Column: Record Detail & Direct Correction Form */}
          <div className="md:col-span-6 p-6 overflow-y-auto space-y-5 bg-neutral-900">
            {selectedRecord ? (
              <>
                <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                      DETALHES DO REGISTRO
                    </span>
                    <h3 className="text-base font-black text-white">
                      {selectedRecord.originCity} → {selectedRecord.destinationCity}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDeleteRecord(selectedRecord.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                      title="Excluir este registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Document context banner */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="text-neutral-400 text-[11px]">Documento de Origem:</span>
                    <p className="font-semibold text-white">{selectedRecord.documentName}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">Página {selectedRecord.pageNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400">Grau de Confiança OCR</span>
                    <p className="text-base font-bold text-emerald-400 font-mono">{selectedRecord.ocrConfidence}%</p>
                  </div>
                </div>

                <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-200">Faltou um tipo de veículo?</h4>
                      <p className="mt-1 text-[10px] text-neutral-500">A inclusão cria um item pendente para conferência; não aprova a rota.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowAddVehicle(value => !value); setAddVehicleError(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-900/50"
                    >
                      <Plus className="h-4 w-4" />
                      Incluir tipo
                    </button>
                  </div>
                  {showAddVehicle && (
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-neutral-800 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div>
                        <label htmlFor="new-route-vehicle-type" className="mb-1.5 block text-[11px] font-semibold text-neutral-400">Tipo de veículo</label>
                        <input
                          id="new-route-vehicle-type"
                          list="review-vehicle-options"
                          value={newVehicleType}
                          onChange={event => setNewVehicleType(event.target.value)}
                          onKeyDown={handleSimpleEnter}
                          placeholder="Ex.: BITREM"
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs font-bold text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                        />
                        <datalist id="review-vehicle-options">
                          {VEHICLE_TYPE_OPTIONS.map(type => <option key={type} value={type} />)}
                        </datalist>
                      </div>
                      <div>
                        <label htmlFor="new-route-vehicle-value" className="mb-1.5 block text-[11px] font-semibold text-neutral-400">Valor total (R$), se souber</label>
                        <input
                          id="new-route-vehicle-value"
                          type="text"
                          inputMode="numeric"
                          value={newVehicleValue}
                          onChange={event => handleNewVehicleValueChange(event.target.value)}
                          onKeyDown={handleSimpleEnter}
                          placeholder="R$ 0,00 (opcional)"
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono text-xs font-bold text-white outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVehicleRecord}
                        disabled={addingVehicle}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {addingVehicle ? 'Incluindo…' : 'Incluir para conferência'}
                      </button>
                      {addVehicleError && <p className="text-[11px] font-medium text-red-400 sm:col-span-3">{addVehicleError}</p>}
                    </div>
                  )}
                </section>

                {selectedRecord.hasFreightBreakdown && (
                  <section className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 text-xs shadow-inner">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-bold uppercase tracking-wide text-neutral-200">Cálculo do frete</h4>
                      <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] font-semibold text-neutral-400">
                        {paymentPercent === undefined ? 'UF pendente' : `${paymentPercent}% desconto`}
                      </span>
                    </div>
                    <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Origem / UF</span>
                      <strong className="mt-0.5 block text-neutral-200">{selectedRecord.originCity}{selectedRecord.originState ? ` / ${selectedRecord.originState}` : ' / UF não identificada'}</strong>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
                        <label htmlFor="manual-freight-weight" className="mb-2 block font-semibold text-neutral-400">Frete peso</label>
                        <input
                          id="manual-freight-weight"
                          type="text"
                          inputMode="numeric"
                          value={editFreightWeightValue}
                          onChange={e => handleFreightBreakdownChange('freight', e.target.value)}
                          placeholder="R$ 0,00"
                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-right font-mono text-sm font-bold text-white placeholder:text-neutral-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                        />
                        <span className="mt-1 block text-[10px] text-neutral-600">Digite os números; os dois últimos são centavos.</span>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
                        <label htmlFor="manual-toll-value" className="mb-2 block font-semibold text-neutral-400">Pedágio</label>
                        <input
                          id="manual-toll-value"
                          type="text"
                          inputMode="numeric"
                          value={editTollValue}
                          onChange={e => handleFreightBreakdownChange('toll', e.target.value)}
                          placeholder="R$ 0,00"
                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-right font-mono text-sm font-bold text-white placeholder:text-neutral-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                        />
                        <span className="mt-1 block text-[10px] text-neutral-600">Digite os números; os dois últimos são centavos.</span>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
                        <span className="block font-semibold text-neutral-400">Valor total recebido</span>
                        {freightWeight != null && toll != null ? (
                          <strong className="mt-1 block font-mono text-base text-white">{formatBrlAmount(manualReceivable)}</strong>
                        ) : (
                          <input
                            id="manual-receivable-value"
                            type="text"
                            inputMode="numeric"
                            value={editReceivableValue}
                            onChange={e => handleReceivableChange(e.target.value)}
                            placeholder="R$ 0,00"
                            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-right font-mono text-sm font-bold text-white placeholder:text-neutral-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                          />
                        )}
                        <span className="mt-1 block text-[10px] text-neutral-600">Preencha as duas parcelas para somar automaticamente.</span>
                      </div>
                      <div className="rounded-lg border border-emerald-900/70 bg-emerald-950/30 p-3">
                        <span className="block font-semibold text-emerald-300/80">Pagamento motorista</span>
                        <strong className="mt-1 block font-mono text-base text-emerald-300">{calculatedDriverPayment != null ? formatBrlAmount(calculatedDriverPayment) : selectedRecord.driverPaymentValue == null ? 'Não calculado' : formatBrlAmount(selectedRecord.driverPaymentValue)}</strong>
                        <span className="mt-1 block text-[10px] text-emerald-200/50">Calculado após o desconto aplicado.</span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 border-t border-neutral-800 pt-2 text-amber-300">
                      {selectedRecord.notes && <p>{selectedRecord.notes}</p>}
                      <p>{calculationRuleMessage}</p>
                    </div>
                  </section>
                )}

                {/* Edit Form */}
                <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 shadow-inner">
                  <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-200">Dados da rota</h4>
                      <p className="mt-1 text-[10px] text-neutral-500">Pressione Enter para aplicar o valor na lista; aprove as rotas depois.</p>
                    </div>
                    <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-neutral-400">Rascunho</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block font-semibold text-neutral-400">Cliente</label>
                    <input
                      type="text"
                      value={editClient}
                      onChange={e => setEditClient(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-white font-medium transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Cidade de origem</label>
                    <input
                      type="text"
                      value={editOrigin}
                      onChange={e => setEditOrigin(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-bold uppercase text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Sigla de origem</label>
                    <input
                      type="text"
                      value={editOriginCode}
                      onChange={e => setEditOriginCode(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono font-bold uppercase text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Cidade de destino</label>
                    <input
                      type="text"
                      value={editDestination}
                      onChange={e => setEditDestination(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-bold uppercase text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Sigla de destino</label>
                    <input
                      type="text"
                      value={editDestinationCode}
                      onChange={e => setEditDestinationCode(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono font-bold uppercase text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block font-semibold text-neutral-400">
                      Perfil de Veículo (Tipo)
                    </label>
                    <input
                      type="text"
                      value={editVehicleType}
                      onChange={e => setEditVehicleType(e.target.value)}
                      onKeyDown={handleDraftFieldKeyDown}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-bold text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Valor total (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editTotalValue}
                      onChange={e => handleEditTotalValueChange(e.target.value)}
                      onKeyDown={handleTotalValueKeyDown}
                      placeholder="R$ 1.000,00 ou -"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono font-extrabold text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-400">Diferencial</label>
                    <select
                      value={editDifferential}
                      onChange={e => { void handleDifferentialChange(e.target.value as Differential); }}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-bold text-white transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 cursor-pointer"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="CPL">CPL</option>
                      <option value="CIRCUITO">CIRCUITO</option>
                      <option value="-">-</option>
                    </select>
                  </div>
                  </div>
                </section>

                {/* Save and confirm actions */}
                <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { void handleSaveSelected(); }}
                    disabled={savingRecord}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs transition-all shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingRecord ? 'Salvando…' : 'Salvar e Marcar como Revisado'}</span>
                  </button>
                </div>
                {saveError && <p role="alert" className="text-right text-xs text-red-400">{saveError}</p>}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                Selecione um registro na lista ao lado para inspecionar e revisar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
