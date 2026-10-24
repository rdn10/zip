import React, { useState, useEffect, useCallback } from 'react';
import { Logo } from './components/Logo.js';
import { ExcelTabBar } from './components/ExcelTabBar.js';
import { CoverDashboard } from './components/CoverDashboard.js';
import { RouteTable } from './components/RouteTable.js';
import { ImportModal } from './components/ImportModal.js';
import { ReviewModal } from './components/ReviewModal.js';
import { CitiesManager } from './components/CitiesManager.js';
import { ExportModal } from './components/ExportModal.js';
import { EditRouteModal } from './components/EditRouteModal.js';
import { City, RouteRecord, Stats, AppSettings } from './types.js';

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState<string>('INICIO');
  const [selectedCityName, setSelectedCityName] = useState<string>('');
  const [selectedBaseView, setSelectedBaseView] = useState(false);
  const [viewMode, setViewMode] = useState<'SPLIT' | 'TABLE_ONLY' | 'COVER_ONLY'>('SPLIT');

  const [cities, setCities] = useState<City[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCities: 0,
    totalRoutes: 0,
    vehicleProfilesCount: 0,
    pendingReviews: 0,
    totalDocuments: 0,
    totalRecords: 0
  });
  const [settings, setSettings] = useState<AppSettings>({
    autoConfirmOcr: false,
    defaultClient: 'Mercado Livre',
    ocrModel: 'gemini-3.8-flash',
    ocrEngine: 'paddle'
  });

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCitiesModalOpen, setIsCitiesModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isEditRouteModalOpen, setIsEditRouteModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RouteRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Load data from backend
  const fetchData = useCallback(async () => {
    try {
      const [citiesRes, routesRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/cities'),
        fetch('/api/routes'),
        fetch('/api/stats'),
        fetch('/api/settings')
      ]);

      let loadedRoutes = routes;
      if (routesRes.ok) {
        loadedRoutes = await routesRes.json();
        setRoutes(loadedRoutes);
      }

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(citiesData);
        if (citiesData.length > 0) {
          const selectedCityExists = selectedCityName === 'ALL' || citiesData.some(
            (city: City) => city.name.trim().toUpperCase() === selectedCityName.trim().toUpperCase()
          );
          if (!selectedCityName || !selectedCityExists) {
            const firstRouteOrigin = loadedRoutes.find(route => route.originCity?.trim())?.originCity.trim();
            setSelectedCityName(firstRouteOrigin || 'ALL');
          }
        } else {
          setSelectedCityName('ALL');
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }
    } catch (err) {
      console.error('Error fetching system data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCityName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tab selection handler
  const handleSelectTab = (tab: string) => {
    if (tab === 'IMPORT') {
      setIsImportModalOpen(true);
    } else if (tab === 'REVIEW') {
      setIsReviewModalOpen(true);
    } else if (tab === 'CITIES') {
      setIsCitiesModalOpen(true);
    } else if (tab === 'INICIO') {
      setSelectedBaseView(false);
      setActiveTab('INICIO');
      setViewMode('SPLIT');
    } else if (tab === 'ALL') {
      setSelectedBaseView(false);
      setActiveTab('ALL');
      setSelectedCityName('ALL');
      setViewMode('TABLE_ONLY');
    } else {
      // City tab clicked
      setSelectedBaseView(false);
      setActiveTab(tab);
      setSelectedCityName(tab);
      setViewMode('TABLE_ONLY');
    }
  };

  // City selection from cover button or dropdown
  const handleSelectCityFromCover = (cityName: string) => {
    setSelectedBaseView(false);
    setSelectedCityName(cityName);
    setActiveTab(cityName);
    setViewMode('TABLE_ONLY');
  };

  // City selection inside route table dropdown
  const handleSelectCityInTable = (cityName: string) => {
    setSelectedBaseView(false);
    setSelectedCityName(cityName);
    if (activeTab !== 'INICIO') {
      setActiveTab(cityName);
    }
  };

  // Route operations
  const handleOpenEditRecord = (record: RouteRecord) => {
    setEditingRecord(record);
    setIsEditRouteModalOpen(true);
  };

  const handleOpenAddRecord = (originCity: string) => {
    setSelectedCityName(originCity);
    setEditingRecord(null);
    setIsEditRouteModalOpen(true);
  };

  const handleSaveRecord = async (recordData: Partial<RouteRecord> & { id?: string }) => {
    try {
      if (recordData.id) {
        // Edit
        const res = await fetch(`/api/routes/${recordData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordData)
        });
        if (res.ok) {
          await fetchData();
        }
      } else {
        // Create
        const res = await fetch('/api/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordData)
        });
        if (res.ok) {
          await fetchData();
        }
      }
    } catch (err) {
      console.error('Error saving record:', err);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Deseja realmente remover esta linha de rota?')) return;
    try {
      const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error deleting route record:', err);
    }
  };

  const handleBatchDeleteRecords = async (ids: string[]) => {
    if (ids.length === 0 || !confirm(`Excluir permanentemente ${ids.length} registro(s) selecionado(s)?`)) return;
    try {
      const res = await fetch('/api/routes/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir os registros.');
      await fetchData();
    } catch (err) {
      console.error('Error deleting selected routes:', err);
      alert(err instanceof Error ? err.message : 'Falha ao excluir os registros.');
    }
  };

  const handleBatchApprove = async (ids: string[]) => {
    try {
      const res = await fetch('/api/routes/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error approving records:', err);
    }
  };

  // City operations
  const handleAddCity = async (name: string, state: string, codes: string[]) => {
    try {
      const res = await fetch('/api/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, state, codes, active: true })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error adding city:', err);
    }
  };

  const handleUpdateCity = async (id: string, updates: Partial<City>) => {
    try {
      const res = await fetch(`/api/cities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating city:', err);
    }
  };

  const handleDeleteCity = async (id: string) => {
    if (!confirm('Deseja excluir esta cidade? As rotas associadas continuarão registradas.')) return;
    try {
      const res = await fetch(`/api/cities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error deleting city:', err);
    }
  };

  // Settings
  const handleToggleAutoConfirm = async (val: boolean) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoConfirmOcr: val })
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, autoConfirmOcr: val }));
      }
    } catch (err) {
      console.error('Error updating settings:', err);
    }
  };

  const handleSetOcrEngine = async (engine: AppSettings['ocrEngine']) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrEngine: engine })
      });
      if (!res.ok) throw new Error('Não foi possível salvar o mecanismo de OCR.');
      setSettings(prev => ({ ...prev, ocrEngine: engine }));
    } catch (err) {
      console.error('Error updating OCR engine:', err);
    }
  };

  const allCityNames = Array.from(
    new Set([
      ...cities.filter(c => c.active).map(c => c.name.toUpperCase().trim()),
      ...routes.map(r => r.originCity.toUpperCase().trim()).filter(Boolean)
    ])
  ).sort();

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden select-none">
      {/* 1. TOP BRANDING & WORKSPACE BAR */}
      <header className="h-20 bg-neutral-950 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-neutral-800 text-xs">
            <span className="font-bold text-white uppercase tracking-wider">
              SISTEMA DE GESTÃO DE ROTAS & OCR INTELIGENTE
            </span>
            <span className="text-neutral-500 font-mono">|</span>
            <span className="text-neutral-400">1.600 Folhas Manuscritas</span>
          </div>
        </div>

      </header>

      {/* 2. EXCEL TAB BAR MATCHING REFERENCE SCREENSHOT */}
      <ExcelTabBar
        cities={cities}
        routes={routes}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onAddCity={() => setIsCitiesModalOpen(true)}
        pendingReviewsCount={stats.pendingReviews}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* 3. MAIN WORKSPACE VIEW */}
      <main className="flex-1 overflow-hidden relative">
        {routes.length === 0 && !isLoading && activeTab !== 'INICIO' ? (
          <section className="relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950 px-6 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(127,29,29,0.16),_transparent_60%)]" />
            <div className="relative z-10 flex flex-col items-center">
              <Logo size="xl" />
              <p className="-mt-10 text-2xl font-semibold tracking-wide text-white sm:-mt-12 sm:text-3xl">
                Vamos começar a viajar
              </p>
              <p className="mt-3 max-w-md text-sm text-neutral-400">
                Importe seu primeiro PDF de frete para cadastrar suas rotas.
              </p>
            </div>
          </section>
        ) : activeTab === 'INICIO' ? (
          viewMode === 'SPLIT' ? (
            <div className="h-full w-full overflow-hidden">
              <CoverDashboard
                stats={stats}
                cities={cities}
                selectedCityName={selectedCityName}
                onSelectCity={handleSelectCityFromCover}
                onOpenImport={() => setIsImportModalOpen(true)}
                onOpenCities={() => setIsCitiesModalOpen(true)}
                onAddNewRoute={handleOpenAddRecord}
              />
            </div>
          ) : viewMode === 'COVER_ONLY' ? (
            /* Cover Only */
            <div className="h-full w-full overflow-hidden">
              <CoverDashboard
                stats={stats}
                cities={cities}
                selectedCityName={selectedCityName}
                onSelectCity={handleSelectCityFromCover}
                onOpenImport={() => setIsImportModalOpen(true)}
                onOpenCities={() => setIsCitiesModalOpen(true)}
                onAddNewRoute={handleOpenAddRecord}
              />
            </div>
          ) : (
            /* Table Only */
            <RouteTable
              currentCityName={selectedCityName}
              baseView={selectedBaseView}
              selectedBase={cities.find(city => city.name.trim().toUpperCase() === selectedCityName.trim().toUpperCase())}
              routes={routes}
              allCities={allCityNames}
              onSelectCity={handleSelectCityInTable}
              onEditRecord={handleOpenEditRecord}
              onDeleteRecord={handleDeleteRecord}
              onAddNewRoute={handleOpenAddRecord}
              onOpenImport={() => setIsImportModalOpen(true)}
            />
          )
        ) : (
          /* Specific City Sheet View (Full Table with Excel feel) */
          <RouteTable
            currentCityName={activeTab}
            baseView={selectedBaseView}
            selectedBase={cities.find(city => city.name.trim().toUpperCase() === activeTab.trim().toUpperCase())}
            routes={routes}
            allCities={allCityNames}
            onSelectCity={handleSelectCityInTable}
            onEditRecord={handleOpenEditRecord}
            onDeleteRecord={handleDeleteRecord}
            onAddNewRoute={handleOpenAddRecord}
            onOpenImport={() => setIsImportModalOpen(true)}
          />
        )}
      </main>

      {/* 4. MODALS */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={async (detectedCity?: string) => {
          await fetchData();
          if (detectedCity) {
            setSelectedCityName(detectedCity);
            setActiveTab(detectedCity);
            setViewMode('TABLE_ONLY');
          }
        }}
        autoConfirm={settings.autoConfirmOcr}
        onToggleAutoConfirm={handleToggleAutoConfirm}
        ocrEngine={settings.ocrEngine || 'paddle'}
        onSetOcrEngine={handleSetOcrEngine}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        records={routes}
        onUpdateRecord={(id, updates) => handleSaveRecord({ id, ...updates })}
        onAddRecord={async recordData => {
          const res = await fetch('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...recordData, forcePendingReview: true })
          });
          if (!res.ok) return null;
          const created = await res.json() as RouteRecord;
          await fetchData();
          return created;
        }}
        onDeleteRecord={handleDeleteRecord}
        onBatchDelete={handleBatchDeleteRecords}
        onBatchApprove={handleBatchApprove}
      />

      <CitiesManager
        isOpen={isCitiesModalOpen}
        onClose={() => setIsCitiesModalOpen(false)}
        cities={cities}
        onAddCity={handleAddCity}
        onUpdateCity={handleUpdateCity}
        onDeleteCity={handleDeleteCity}
        onSelectCity={cityName => {
          setSelectedBaseView(true);
          setSelectedCityName(cityName);
          setActiveTab(cityName);
          setViewMode('TABLE_ONLY');
          setIsCitiesModalOpen(false);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        cities={cities}
        currentCityName={selectedCityName}
        onDataRestored={fetchData}
      />

      <EditRouteModal
        isOpen={isEditRouteModalOpen}
        onClose={() => setIsEditRouteModalOpen(false)}
        recordToEdit={editingRecord}
        defaultOriginCity={selectedCityName}
        cities={cities}
        onSave={handleSaveRecord}
      />

    </div>
  );
}
