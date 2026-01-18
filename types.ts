
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
  coefficient: number; // e.g., 0.78
  inpsType: string; // 'Gestione Separata', 'Artigiani', etc.
  vatRegime: string; // Description of VAT application (e.g. 'Esente art. 10')
  active: boolean;
  
  // -- Dynamic Invoice Configuration --
  hasCassa: boolean;        // If true, adds a calculated line
  cassaLabel?: string;      // e.g. "Rivalsa INPS", "Contributo Integrativo ENPAP"
  cassaRate?: number;       // e.g. 0.04 for 4%
  cassaIsTaxable: boolean;  // TRUE for Rivalsa INPS (Gestione Separata), FALSE for Private Cassas (ENPAP, Inarcassa)
  
  // -- Estimation Configuration --
  subjectiveContributionRate?: number; // e.g. 0.10 for ENPAP, 0.2607 for GS. Used for TaxSimulator.
}

export interface Client {
  id: string;
  name: string; // Ragione Sociale / Nome Cognome
  fiscalCode: string; // Codice Fiscale / P.IVA
  
  // Linked Activity Data
  activityId?: string; // Reference to AtecoActivity
  atecoCode: string;
  profitabilityCoefficient: number; // e.g., 0.78 for 78%
  
  taxRate: TaxRate;
  email?: string;
  notes?: string;
  status: ClientStatus;
}

export interface GlobalTaxConfig {
  annualRevenueLimit: number; // e.g., 85000
  standardInpsRate: number; // e.g., 0.2607
}

export interface Invoice {
  id: string;
  clientId: string; // Foreign key to Client
  number: string;
  date: string; // ISO date string
  clientName: string; // The customer of the client
  
  // -- Amounts --
  taxableAmount: number; // Imponibile (The service fee)
  cassaAmount: number;   // Calculated contribution
  amount: number;        // Total Amount (Gross amount received)
  
  status: PaymentStatus;
  paymentDate?: string;
  
  // -- Attachments --
  attachment?: string; // Base64 string
  fileName?: string;
}

export interface InpsPayment {
  id: string;
  clientId: string;
  date: string; // Date of payment (Cash basis)
  amount: number;
  description?: string; // e.g., "Saldo 2023", "Acconto 2024"
  
  // -- Attachments --
  attachment?: string; // Base64 string
  fileName?: string;
}

export interface TaxCalculationResult {
  totalRevenue: number;
  taxableIncome: number; // Revenue * Coefficient
  grossTax: number;
  netIncome: number;
  remainingLimit: number;
  estimatedInps: number;
}

// -- LOGGING SYSTEM --
export type LogActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
export type LogEntityType = 'INVOICE' | 'CLIENT' | 'PAYMENT' | 'SETTINGS';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO String
  action: LogActionType;
  entity: LogEntityType;
  description: string;
  clientId?: string; // Optional context
  clientName?: string; // Snapshot of name for display
}
