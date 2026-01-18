
import { Client, TaxRate, Invoice, PaymentStatus, GlobalTaxConfig, ClientStatus, InpsPayment, AtecoActivity } from './types';
import { LayoutDashboard, FileText, Calculator, Settings, BrainCircuit, Users, FileCheck, Landmark, History, Cloud } from 'lucide-react';

export const DEFAULT_TAX_CONFIG: GlobalTaxConfig = {
  annualRevenueLimit: 85000,
  standardInpsRate: 0.2607, // 26.07% Gestione Separata
};

// -- ATECO ACTIVITY REGISTRY --
export const ATECO_ACTIVITIES: AtecoActivity[] = [
  {
    id: 'act_psychologist_enpap',
    code: '86.90.30',
    description: 'Psicologo (Cassa ENPAP)',
    coefficient: 0.78,
    inpsType: 'ENPAP',
    vatRegime: 'Esente art. 10 DPR 633/72',
    active: true,
    // Invoice Config: ENPAP has 2% integrative contribution which is NOT taxable revenue for the professional
    hasCassa: true,
    cassaLabel: 'Contributo Integrativo ENPAP',
    cassaRate: 0.02,
    cassaIsTaxable: false, 
    subjectiveContributionRate: 0.10 // Approx 10% subjective contribution
  },
  {
    id: 'act_psychologist_gs',
    code: '86.90.30',
    description: 'Psicologo (Gestione Separata)',
    coefficient: 0.78,
    inpsType: 'Gestione Separata',
    vatRegime: 'Esente art. 10 DPR 633/72',
    active: true,
    // Invoice Config: Rivalsa INPS 4% is taxable revenue
    hasCassa: true,
    cassaLabel: 'Rivalsa INPS',
    cassaRate: 0.04,
    cassaIsTaxable: true,
    subjectiveContributionRate: 0.2607
  },
  {
    id: 'act_dev',
    code: '62.02.00',
    description: 'Consulenza Informatica / Sviluppatore',
    coefficient: 0.67,
    inpsType: 'Gestione Separata',
    vatRegime: 'Non soggetto IVA (Forfettario)',
    active: true,
    hasCassa: true,
    cassaLabel: 'Rivalsa INPS',
    cassaRate: 0.04,
    cassaIsTaxable: true,
    subjectiveContributionRate: 0.2607
  },
  {
    id: 'act_architect',
    code: '71.11.00',
    description: 'Architetto (Inarcassa)',
    coefficient: 0.78,
    inpsType: 'Inarcassa',
    vatRegime: 'Non soggetto IVA (Forfettario)',
    active: true,
    hasCassa: true,
    cassaLabel: 'Contributo Integrativo Inarcassa',
    cassaRate: 0.04,
    cassaIsTaxable: false,
    subjectiveContributionRate: 0.145 // Approx subjective
  },
  {
    id: 'act_commerce',
    code: '47.91.10',
    description: 'E-commerce',
    coefficient: 0.40,
    inpsType: 'Gestione Commercianti',
    vatRegime: 'Non soggetto IVA (Forfettario)',
    active: true,
    hasCassa: false,
    cassaIsTaxable: false,
    subjectiveContributionRate: 0.2448 // Minimal rate approx
  }
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Mario Rossi (Sviluppatore)',
    fiscalCode: 'RSSMRA80A01H501U',
    activityId: 'act_dev',
    atecoCode: '62.02.00', 
    profitabilityCoefficient: 0.67, 
    taxRate: TaxRate.STARTUP, 
    status: 'active',
    email: 'mario.rossi@example.com'
  },
  {
    id: 'c2',
    name: 'Giulia Verdi (Psicologa)',
    fiscalCode: 'VRDGLA85M45H501K',
    activityId: 'act_psychologist_enpap',
    atecoCode: '86.90.30',
    profitabilityCoefficient: 0.78,
    taxRate: TaxRate.STANDARD,
    status: 'active',
    email: 'giulia.psico@example.com'
  },
  {
    id: 'c3',
    name: 'Luca Bianchi (Psicologo GS)',
    fiscalCode: 'BNCLCU90T12F205L',
    activityId: 'act_psychologist_gs',
    atecoCode: '86.90.30',
    profitabilityCoefficient: 0.78,
    taxRate: TaxRate.STARTUP,
    status: 'active',
    email: 'luca.gs@example.com'
  }
];

export const CLIENT_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Incassi (Fatture)', icon: FileText },
  { id: 'inps', label: 'Contributi Versati', icon: Landmark },
  { id: 'quadro-lm', label: 'Quadro LM', icon: FileCheck },
  { id: 'advisor', label: 'AI Advisor', icon: BrainCircuit },
  { id: 'settings', label: 'Anagrafica', icon: Settings },
];

export const STUDIO_MENU_ITEMS = [
  { id: 'studio-dashboard', label: 'Panoramica Studio', icon: Users },
  { id: 'activity-log', label: 'Registro Attività', icon: History },
  { id: 'studio-params', label: 'Parametri Globali', icon: Settings },
  { id: 'cloud-backup', label: 'Backup Cloud', icon: Cloud },
];

export const MOCK_INVOICES: Invoice[] = [
  // Client 1 (Dev - Rivalsa 4% Taxable)
  { id: '1', clientId: 'c1', number: '1/2024', date: '2024-01-15', clientName: 'Tech Corp SRL', taxableAmount: 2403.85, cassaAmount: 96.15, amount: 2500, status: PaymentStatus.PAID, paymentDate: '2024-01-20' },
  
  // Client 2 (Psicologa ENPAP - Integrativo 2% Non-Taxable)
  // Fee 1000 + 2% (20) = 1020 Total. Revenue for LM is 1000.
  { id: '2', clientId: 'c2', number: '1/2024', date: '2024-02-10', clientName: 'Paziente A', taxableAmount: 1000, cassaAmount: 20, amount: 1020, status: PaymentStatus.PAID, paymentDate: '2024-02-15' },
  { id: '3', clientId: 'c2', number: '2/2024', date: '2024-03-05', clientName: 'Paziente B', taxableAmount: 500, cassaAmount: 10, amount: 510, status: PaymentStatus.PAID, paymentDate: '2024-03-05' },

  // Client 3 (Psicologo GS - Rivalsa 4% Taxable)
  // Fee 1000 + 4% (40) = 1040 Total. Revenue for LM is 1040.
  { id: '4', clientId: 'c3', number: '1/2024', date: '2024-01-20', clientName: 'Clinica Privata', taxableAmount: 2000, cassaAmount: 80, amount: 2080, status: PaymentStatus.PAID, paymentDate: '2024-01-25' },
];

export const MOCK_INPS_PAYMENTS: InpsPayment[] = [
  { id: 'p1', clientId: 'c1', date: '2024-05-16', amount: 1200, description: 'Saldo GS 2023' },
  { id: 'p2', clientId: 'c2', date: '2024-08-20', amount: 800, description: 'Saldo ENPAP 2023' },
];
