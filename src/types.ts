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
  client: string;
  originCity: string;
  originState?: string;
  originCode: string;
  destinationCity: string;
  destinationCode: string;
  vehicleType: string;
  totalValue: string;
  numericValue: number | null;
  freightWeightValue?: number | null;
  tollValue?: number | null;
  hasFreightBreakdown?: boolean;
  receivableValue?: number | null;
  driverPaymentValue?: number | null;
  driverPaymentPercent?: 10 | 20;
  differential: Differential;
  ocrConfidence: number;
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

export interface Stats {
  totalCities: number;
  totalRoutes: number;
  vehicleProfilesCount: number;
  pendingReviews: number;
  totalDocuments: number;
  totalRecords: number;
}

export interface AppSettings {
  autoConfirmOcr: boolean;
  defaultClient: string;
  ocrModel: string;
  ocrEngine: 'paddle' | 'rapidocr';
}
