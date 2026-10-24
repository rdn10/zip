import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type { DatabaseSchema, City, RouteRecord, UploadedDocument, DocumentPage, AppSettings } from './types.ts';
import { getInitialDefaultCities } from './defaultMeliBases.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.resolve(__dirname, '../storage/uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const INITIAL_CITIES: City[] = getInitialDefaultCities();

export const STANDARD_VEHICLES = [
  'BITREM',
  'BITREM 3º',
  'CARRETA CASA',
  'TRUCK CASA',
  'CARRETA AGREGADO',
  'CARRETA 3º',
  'TRUCK 3º',
  'TOCO CASA',
  'TOCO 3º',
  'MÉDIO (3/4 - CASA)',
  'MÉDIO (3/4 - 3º)',
  'VUC CASA',
  'VUC 3º'
];

function routeDuplicateKey(route: RouteRecord): string {
  return JSON.stringify([
    route.documentId,
    route.documentPageId,
    route.pageNumber,
    route.client.trim().toUpperCase(),
    route.originCity.trim().toUpperCase(),
    route.originState,
    route.originCode.trim().toUpperCase(),
    route.destinationCity.trim().toUpperCase(),
    route.destinationCode.trim().toUpperCase(),
    route.vehicleType.trim().toUpperCase(),
    route.totalValue,
    route.numericValue,
    route.differential,
    route.freightWeightValue,
    route.tollValue,
    route.hasFreightBreakdown,
    route.receivableValue,
    route.driverPaymentValue,
    route.driverPaymentPercent,
    route.reviewStatus,
    route.ocrConfidence,
    route.notes
  ]);
}

function generateSeedRoutes(): RouteRecord[] {
  return [];
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.cities && parsed.routeRecords) {
          parsed.settings = { ocrEngine: 'paddle', ...parsed.settings };
          // If cities exist in parsed, preserve them
          if (parsed.cities.length === 0) {
            parsed.cities = INITIAL_CITIES;
          }
          // Keep legacy routes in sync with all active codes for each city.
          // Older imports created a separate copy of every destination route per code.
          let routeDataChanged = false;
          const normalizeName = (value: string) => value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .trim();
          const validRouteRecords: RouteRecord[] = [];
          const extractedCountByDocument = new Map<string, number>();
          const seenRouteRecords = new Set<string>();
          for (const route of parsed.routeRecords as RouteRecord[]) {
            // Do not retain OCR's stray single digits as complete freight
            // totals (e.g. BITREM R$ 4,00). CASA breakdowns store amounts in
            // freight/toll fields and are unaffected by this total check.
            if (!route.hasFreightBreakdown && route.numericValue != null && route.numericValue > 0 && route.numericValue < 100) {
              routeDataChanged = true;
              continue;
            }

            // If OCR reads the same city on both ends but the filename gives
            // distinct endpoints, use the filename's origin as the stronger
            // route hint. Resolve compound registered bases to the shortest
            // matching name (e.g. "RIO DE JANEIRO" -> "RIO DE JANEIRO (CORDOVIL)").
            if (route.originCity === route.destinationCity && route.documentName) {
              const stem = route.documentName.replace(/\.pdf$/i, '');
              const endpoints = stem.split(/\s+x\s+|_x_|-x-/i).map(part => part.replace(/[_-]+/g, ' ').trim());
              const [originPart, destinationPart] = endpoints;
              if (originPart && destinationPart && normalizeName(originPart) !== normalizeName(destinationPart)) {
                const candidates = (parsed.cities as City[])
                  .filter(city => normalizeName(city.name) === normalizeName(originPart) || normalizeName(city.name).startsWith(`${normalizeName(originPart)} `))
                  .sort((a, b) => a.name.length - b.name.length);
                const filenameOrigin = candidates[0];
                if (filenameOrigin && normalizeName(route.originCity) === normalizeName(destinationPart)) {
                  route.originCity = filenameOrigin.name;
                  const codes = filenameOrigin.codes.filter(code => code.active).map(code => code.code);
                  if (codes.length) route.originCode = codes.join('/');
                  routeDataChanged = true;
                }
              }
            }

            const origin = parsed.cities.find((city: City) => city.name.trim().toUpperCase() === route.originCity.trim().toUpperCase());
            const destination = parsed.cities.find((city: City) => city.name.trim().toUpperCase() === route.destinationCity.trim().toUpperCase());
            const originCodes = origin?.codes.filter((code: City['codes'][number]) => code.active).map((code: City['codes'][number]) => code.code) ?? [];
            const destinationCodes = destination?.codes.filter((code: City['codes'][number]) => code.active).map((code: City['codes'][number]) => code.code) ?? [];
            if (originCodes.length && route.originCode !== originCodes.join('/')) {
              route.originCode = originCodes.join('/');
              routeDataChanged = true;
            }
            if (destinationCodes.length && route.destinationCode !== destinationCodes.join('/')) {
              route.destinationCode = destinationCodes.join('/');
              routeDataChanged = true;
            }
            if (route.hasFreightBreakdown && route.driverPaymentValue != null) {
              const paymentValue = route.driverPaymentValue;
              const formattedPayment = `R$ ${paymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              if (route.totalValue !== formattedPayment || route.numericValue !== paymentValue) {
                route.totalValue = formattedPayment;
                route.numericValue = paymentValue;
                routeDataChanged = true;
              }
            }
            const duplicateKey = routeDuplicateKey(route);
            if (seenRouteRecords.has(duplicateKey)) {
              routeDataChanged = true;
              continue;
            }
            seenRouteRecords.add(duplicateKey);
            validRouteRecords.push(route);
          }
          if (validRouteRecords.length !== parsed.routeRecords.length) {
            parsed.routeRecords = validRouteRecords;
            for (const document of parsed.uploadedDocuments || []) {
              extractedCountByDocument.set(document.id, 0);
            }
            for (const route of validRouteRecords) {
              extractedCountByDocument.set(route.documentId, (extractedCountByDocument.get(route.documentId) || 0) + 1);
            }
            for (const document of parsed.uploadedDocuments || []) {
              const count = extractedCountByDocument.get(document.id);
              if (count !== undefined && document.totalRecordsExtracted !== count) {
                document.totalRecordsExtracted = count;
                routeDataChanged = true;
              }
            }
            routeDataChanged = true;
          }
          if (routeDataChanged) this.save(parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading database.json, initializing clean database:', err);
    }

    const cleanDb: DatabaseSchema = {
      cities: INITIAL_CITIES,
      uploadedDocuments: [],
      documentPages: [],
      routeRecords: [],
      settings: {
        autoConfirmOcr: false,
        defaultClient: 'Mercado Livre',
        ocrModel: 'gemini-3.8-flash',
        ocrEngine: 'paddle'
      }
    };

    this.save(cleanDb);
    return cleanDb;
  }

  public save(dataToSave?: DatabaseSchema) {
    if (dataToSave) {
      this.data = dataToSave;
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  // --- Clear / Reset All Data ---
  public clearAllData(options: { keepCities?: boolean } = { keepCities: true }): {
    clearedRoutes: number;
    clearedDocuments: number;
  } {
    const clearedRoutes = this.data.routeRecords.length;
    const clearedDocuments = this.data.uploadedDocuments.length;

    this.data.routeRecords = [];
    this.data.uploadedDocuments = [];
    this.data.documentPages = [];

    if (options.keepCities === false) {
      this.data.cities = [...INITIAL_CITIES];
    }

    // Clean physical uploads folder
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const file of files) {
          const filePath = path.join(UPLOADS_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (cleanErr) {
      console.warn('Error cleaning uploads directory:', cleanErr);
    }

    this.save();
    return { clearedRoutes, clearedDocuments };
  }

  // --- Stats ---
  public getStats() {
    const uniqueCities = this.data.cities.filter(c => c.active).length;
    // Calculate unique routes (originCity + destinationCity + differential)
    const uniqueRouteKeys = new Set(
      this.data.routeRecords.map(r => `${r.originCity}__${r.destinationCity}__${r.destinationCode}__${r.differential}`)
    );
    const vehicleProfilesCount = this.data.routeRecords.length > 0
      ? new Set(this.data.routeRecords.map(r => r.vehicleType)).size
      : 10;
    const pendingReviews = this.data.routeRecords.filter(r => r.reviewStatus === 'AGUARDANDO CONFERÊNCIA').length;
    const totalDocuments = this.data.uploadedDocuments.length;

    return {
      totalCities: uniqueCities,
      totalRoutes: uniqueRouteKeys.size,
      vehicleProfilesCount,
      pendingReviews,
      totalDocuments,
      totalRecords: this.data.routeRecords.length
    };
  }

  // --- Cities ---
  public getCities(): City[] {
    return this.data.cities;
  }

  public getCityByName(name: string): City | undefined {
    const normalized = name.trim().toUpperCase();
    return this.data.cities.find(c => c.name.trim().toUpperCase() === normalized);
  }

  public addCity(cityData: { name: string; state: string; codes: string[]; active?: boolean }): City {
    const existing = this.getCityByName(cityData.name);
    if (existing) {
      // Merge codes
      for (const codeStr of cityData.codes) {
        const cleanCode = codeStr.trim().toUpperCase();
        if (!existing.codes.some(c => c.code === cleanCode)) {
          existing.codes.push({
            id: `c-${crypto.randomBytes(4).toString('hex')}`,
            code: cleanCode,
            active: true
          });
        }
      }
      this.save();
      return existing;
    }

    const newCity: City = {
      id: `city-${crypto.randomBytes(6).toString('hex')}`,
      name: cityData.name.trim().toUpperCase(),
      state: (cityData.state || 'BR').trim().toUpperCase(),
      active: cityData.active ?? true,
      createdAt: new Date().toISOString(),
      codes: cityData.codes.map(c => ({
        id: `c-${crypto.randomBytes(4).toString('hex')}`,
        code: c.trim().toUpperCase(),
        active: true
      }))
    };
    this.data.cities.push(newCity);
    this.save();
    return newCity;
  }

  public updateCity(id: string, updates: Partial<City>): City | null {
    const index = this.data.cities.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.data.cities[index] = { ...this.data.cities[index], ...updates };
    this.save();
    return this.data.cities[index];
  }

  public deleteCity(id: string): boolean {
    const index = this.data.cities.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.data.cities.splice(index, 1);
    this.save();
    return true;
  }

  // --- Documents ---
  public getDocuments(): UploadedDocument[] {
    return [...this.data.uploadedDocuments].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  public getDocumentById(id: string): UploadedDocument | undefined {
    return this.data.uploadedDocuments.find(d => d.id === id);
  }

  public getDocumentByHash(hash: string): UploadedDocument | undefined {
    return this.data.uploadedDocuments.find(d => d.fileHash === hash);
  }

  public addDocument(doc: UploadedDocument): UploadedDocument {
    this.data.uploadedDocuments.push(doc);
    this.save();
    return doc;
  }

  public updateDocument(id: string, updates: Partial<UploadedDocument>): UploadedDocument | null {
    const index = this.data.uploadedDocuments.findIndex(d => d.id === id);
    if (index === -1) return null;
    this.data.uploadedDocuments[index] = { ...this.data.uploadedDocuments[index], ...updates };
    this.save();
    return this.data.uploadedDocuments[index];
  }

  public addDocumentPage(page: DocumentPage): DocumentPage {
    this.data.documentPages.push(page);
    this.save();
    return page;
  }

  public getDocumentPages(docId: string): DocumentPage[] {
    return this.data.documentPages.filter(p => p.documentId === docId);
  }

  // --- Routes ---
  public getRoutes(filters?: {
    originCity?: string;
    destinationCity?: string;
    differential?: string;
    reviewStatus?: string;
    documentId?: string;
    search?: string;
  }): RouteRecord[] {
    let result = [...this.data.routeRecords];

    if (filters?.originCity) {
      const orig = filters.originCity.trim().toUpperCase();
      result = result.filter(r => r.originCity.toUpperCase() === orig);
    }
    if (filters?.destinationCity) {
      const dest = filters.destinationCity.trim().toUpperCase();
      result = result.filter(r => r.destinationCity.toUpperCase() === dest);
    }
    if (filters?.differential && filters.differential !== 'ALL') {
      result = result.filter(r => r.differential === filters.differential);
    }
    if (filters?.reviewStatus && filters.reviewStatus !== 'ALL') {
      result = result.filter(r => r.reviewStatus === filters.reviewStatus);
    }
    if (filters?.documentId) {
      result = result.filter(r => r.documentId === filters.documentId);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      result = result.filter(r =>
        r.originCity.toLowerCase().includes(s) ||
        r.destinationCity.toLowerCase().includes(s) ||
        r.originCode.toLowerCase().includes(s) ||
        r.destinationCode.toLowerCase().includes(s) ||
        r.vehicleType.toLowerCase().includes(s) ||
        r.client.toLowerCase().includes(s)
      );
    }

    return result;
  }

  public addRouteRecords(newRecords: RouteRecord[]): number {
    this.data.routeRecords.push(...newRecords);
    this.save();
    return newRecords.length;
  }

  public removeDocumentRoutesExcept(documentId: string, keepIds: string[]): number {
    const keep = new Set(keepIds);
    const before = this.data.routeRecords.length;
    this.data.routeRecords = this.data.routeRecords.filter(record =>
      record.documentId !== documentId || keep.has(record.id)
    );
    const removed = before - this.data.routeRecords.length;
    if (removed > 0) this.save();
    return removed;
  }

  public updateRouteRecord(id: string, updates: Partial<RouteRecord>): RouteRecord | null {
    const index = this.data.routeRecords.findIndex(r => r.id === id);
    if (index === -1) return null;
    this.data.routeRecords[index] = {
      ...this.data.routeRecords[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.routeRecords[index];
  }

  public deleteRouteRecord(id: string): boolean {
    const index = this.data.routeRecords.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.data.routeRecords.splice(index, 1);
    this.save();
    return true;
  }

  public batchUpdateStatus(ids: string[], reviewStatus: RouteRecord['reviewStatus']): number {
    let updatedCount = 0;
    const now = new Date().toISOString();
    for (const id of ids) {
      const r = this.data.routeRecords.find(item => item.id === id);
      if (r) {
        r.reviewStatus = reviewStatus;
        r.updatedAt = now;
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      this.save();
    }
    return updatedCount;
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  public restoreData(newData: Partial<DatabaseSchema>) {
    if (newData.cities && Array.isArray(newData.cities)) {
      this.data.cities = newData.cities;
    }
    if (newData.routeRecords && Array.isArray(newData.routeRecords)) {
      this.data.routeRecords = newData.routeRecords;
    }
    if (newData.uploadedDocuments && Array.isArray(newData.uploadedDocuments)) {
      this.data.uploadedDocuments = newData.uploadedDocuments;
    }
    if (newData.documentPages && Array.isArray(newData.documentPages)) {
      this.data.documentPages = newData.documentPages;
    }
    if (newData.settings) {
      this.data.settings = { ...this.data.settings, ...newData.settings };
    }
    this.save();
    return this.getStats();
  }
}

export const db = new Database();
export { UPLOADS_DIR };
