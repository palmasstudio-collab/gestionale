
export enum TaxRate {
  STARTUP = 0.05,
  STANDARD = 0.15,
}

export enum PaymentStatus {
  PAID = 'Incassata',
  PENDING = 'Da Incassare',
}

export type ClientStatus = 'active' | 'ceased';

export interface AtecoActivity {
  id: string;
  code: string;
  description: string;
  coefficient: number;
  inpsType: string;
  vatRegime: string;
  active: boolean;
  hasCassa: boolean;
  cassaLabel?: string;
  cassaRate?: number;
  cassaIsTaxable: boolean;
  subjectiveContributionRate?: number;
}

export interface Client {
  id: string;
  name: string;
  fiscalCode: string;
  activityId?: string;
  atecoCode: string;
  profitabilityCoefficient: number;
  taxRate: TaxRate;
  email?: string;
  notes?: string;
  status: ClientStatus;
  spreadsheetId?: string; // ID del foglio Google "Database"
}

export interface GlobalTaxConfig {
  annualRevenueLimit: number;
  standardInpsRate: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string;
  date: string;
  clientName: string;
  taxableAmount: number;
  cassaAmount: number;
  amount: number;
  status: PaymentStatus;
  paymentDate?: string;
  attachment?: string;
  fileName?: string;
}

export interface InpsPayment {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  description?: string;
  attachment?: string;
  fileName?: string;
}

export interface TaxCalculationResult {
  totalRevenue: number;
  taxableIncome: number;
  grossTax: number;
  netIncome: number;
  remainingLimit: number;
  estimatedInps: number;
}

export type LogActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
export type LogEntityType = 'INVOICE' | 'CLIENT' | 'PAYMENT' | 'SETTINGS';

export interface LogEntry {
  id: string;
  timestamp: string;
  action: LogActionType;
  entity: LogEntityType;
  description: string;
  clientId?: string;
  clientName?: string;
}
