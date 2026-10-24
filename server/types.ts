export interface CityCode {
  id: string;
  code: string;
  active: boolean;
}

export interface City {
  id: string;
  name: string;
  state: string;
  codes: CityCode[];
  active: boolean;
  createdAt: string;
  address?: string;
  restrictions?: string;
  cnpj?: string;
}

export type ReviewStatus = 'PROCESSADO' | 'AGUARDANDO CONFERÊNCIA' | 'REVISADO' | 'ERRO DE EXTRAÇÃO';

export type Differential = 'NORMAL' | 'CPL' | 'CIRCUITO' | '-';

export interface RouteRecord {
  id: string;
  documentId: string;
  documentPageId: string;
  documentName: string;
  pageNumber: number;
  client: string; // e.g. "Mercado Livre"
  originCity: string; // e.g. "QUEIMADOS"
  originState?: string;
  originCode: string; // e.g. "SRJ2"
  destinationCity: string; // e.g. "SÃO JOÃO DE MERITI"
  destinationCode: string; // e.g. "BRRJ02"
  vehicleType: string; // e.g. "CARRETA CASA", "BITREM 3º", etc.
  totalValue: string; // formatted: "R$ 1.000,00" or "-"
  numericValue: number | null;
  freightWeightValue?: number | null;
  tollValue?: number | null;
  hasFreightBreakdown?: boolean;
  receivableValue?: number | null;
  driverPaymentValue?: number | null;
  driverPaymentPercent?: 10 | 20;
  differential: Differential;
  ocrConfidence: number; // 0 - 100
  reviewStatus: ReviewStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  fileHash: string;
  fileSize: number;
  storagePath: string;
  pageCount: number;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  errorMessage?: string;
  autoConfirmed: boolean;
  totalRecordsExtracted: number;
  uploadedAt: string;
  processingStartedAt?: string;
  processedAt?: string;
}

export interface DocumentPage {
  id: string;
  documentId: string;
  pageNumber: number;
  imagePreviewPath?: string;
  rawOcrText?: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  extractedRecordsCount: number;
  createdAt: string;
}

export interface AppSettings {
  autoConfirmOcr: boolean;
  defaultClient: string;
  ocrModel: string;
  ocrEngine: 'paddle' | 'rapidocr';
}

export interface DatabaseSchema {
  cities: City[];
  uploadedDocuments: UploadedDocument[];
  documentPages: DocumentPage[];
  routeRecords: RouteRecord[];
  settings: AppSettings;
}
