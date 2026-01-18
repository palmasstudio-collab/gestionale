import React, { useState, useMemo } from 'react';
import { Invoice, Client, PaymentStatus, TaxCalculationResult, GlobalTaxConfig } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Info, AlertCircle } from 'lucide-react';

interface TaxSimulatorProps {
  invoices: Invoice[];
  client: Client;
  taxConfig: GlobalTaxConfig;
}

export const TaxSimulator: React.FC<TaxSimulatorProps> = ({ invoices, client, taxConfig }) => {
  const currentYear = new Date().getFullYear();
  
  // Detect available years
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    invoices.forEach(inv => {
      if (inv.paymentDate) {
        years.add(new Date(inv.paymentDate).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const calculation: TaxCalculationResult = useMemo(() => {
    // Get Activity Config for Rules
    const activity = ATECO_ACTIVITIES.find(a => a.id === client.activityId);
    
    // 1. Calculate Revenue (Cash Basis)
    const paidInvoices = invoices.filter(
      i => i.status === PaymentStatus.PAID && new Date(i.paymentDate || '').getFullYear() === selectedYear
    );
    
    // Logic for Taxable Base (LM22):
    const revenueForCoefficient = paidInvoices.reduce((sum, i) => {
       if (activity?.hasCassa) {
         if (activity.cassaIsTaxable) {
            return sum + (i.taxableAmount + (i.cassaAmount || 0));
         } else {
            return sum + i.taxableAmount;
         }
       }
       return sum + i.amount;
    }, 0);
    
    // Total Turnover
    const totalRevenue = revenueForCoefficient; 

    // 2. Taxable Income (Imponibile) = Corrected Revenue * Coefficient
    const taxableIncome = revenueForCoefficient * client.profitabilityCoefficient;

    // 3. Calculate Tax (Imposta Sostitutiva)
    const grossTax = taxableIncome * client.taxRate;

    // 4. Calculate INPS/Cassa Estimation
    const estimationRate = activity?.subjectiveContributionRate || taxConfig.standardInpsRate;
    const estimatedInps = taxableIncome * estimationRate;

    const netIncome = totalRevenue - grossTax - estimatedInps;

    return {
      totalRevenue,
      taxableIncome,
      grossTax,
      netIncome,
      remainingLimit: taxConfig.annualRevenueLimit - totalRevenue,
      estimatedInps
    };
  }, [invoices, client, taxConfig, selectedYear]);

  const activity = ATECO_ACTIVITIES.find(a => a.id === client.activityId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Simulatore Fiscale</h2>
          <p className="text-gray-500">Stima basata su parametri globali dello studio e configurazione attività.</p>
        </div>
         <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Anno Simulazione</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border-gray-300 border p-2 text-sm font-medium focus:ring-indigo-500 bg-white"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Dati Regime Applicato" className="h-full">
          <div className="space-y-4">
             <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Coefficiente di Redditività</span>
              <span className="font-bold">{(client.profitabilityCoefficient * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Aliquota Imposta Sostitutiva</span>
              <span className="font-bold">{(client.taxRate * 100).toFixed(0)}%</span>
            </div>
            
            {activity?.hasCassa && (
               <div className="flex justify-between py-2 border-b border-gray-100 bg-indigo-50 px-2 -mx-2">
                <span className="text-indigo-800 text-sm">Configurazione Cassa</span>
                <span className="font-bold text-indigo-900 text-sm">
                  {activity.cassaIsTaxable ? 'Imponibile (Rivalsa)' : 'Non Imponibile (Integrativo)'}
                </span>
              </div>
            )}

            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Limite Ricavi Annuo (Globale)</span>
              <span className="font-bold">€ {taxConfig.annualRevenueLimit.toLocaleString('it-IT')}</span>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded-md flex items-start gap-3 mt-4">
              <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Il calcolo Contributi è una stima basata su <strong>{activity?.inpsType || 'Gestione Separata'}</strong> 
                (aliquota stimata: {((activity?.subjectiveContributionRate || taxConfig.standardInpsRate) * 100).toFixed(2)}%).
                Verificare sempre i minimali se previsti.
              </p>
            </div>
          </div>
        </Card>

        <Card title={`Dettaglio Calcolo ${selectedYear}`} className="h-full bg-slate-50 border-slate-200">
           <div className="space-y-3">
             <div className="flex justify-between items-center">
               <span className="text-gray-600">Totale Ricavi (LM22)</span>
               <span className="font-semibold text-lg">€ {calculation.totalRevenue.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
             
             {activity?.hasCassa && !activity.cassaIsTaxable && (
               <div className="flex justify-between items-center text-xs text-gray-500 pl-4">
                 <span>(Escluso contributo integrativo in fattura)</span>
               </div>
             )}

             <div className="flex justify-between items-center text-sm text-gray-500 pl-4 border-l-2 border-gray-300">
               <span>Imponibile Lordo ({(client.profitabilityCoefficient * 100).toFixed(0)}%)</span>
               <span>€ {calculation.taxableIncome.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>

             <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-red-600">
                  <span className="font-medium">Imposta Sostitutiva (Stima)</span>
                  <span className="font-bold">- € {calculation.grossTax.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
                </div>
                 <div className="flex justify-between items-center text-red-600 mt-2">
                  <span className="font-medium">Contributi (Stima su Reddito)</span>
                  <span className="font-bold">- € {(calculation as any).estimatedInps.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
                </div>
             </div>

             <div className="pt-4 border-t-2 border-gray-300 mt-2">
               <div className="flex justify-between items-center text-indigo-700">
                 <span className="text-lg font-bold">Netto Stimato</span>
                 <span className="text-2xl font-bold">€ {calculation.netIncome.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
               </div>
             </div>
           </div>
        </Card>
      </div>

      {calculation.remainingLimit < 15000 && calculation.remainingLimit >= 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-bold text-red-800">Attenzione al limite di fatturato</h3>
            <p className="text-sm text-red-700">
              Restano solo <strong>€ {calculation.remainingLimit.toLocaleString('it-IT')}</strong> al cliente per l'anno {selectedYear} prima di uscire dal regime.
            </p>
          </div>
        </div>
      )}
      
      {calculation.remainingLimit < 0 && (
        <div className="bg-red-100 border-l-4 border-red-700 p-4 rounded-md flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-800" />
          <div>
            <h3 className="font-bold text-red-900">Limite Superato!</h3>
            <p className="text-sm text-red-800">
              Il fatturato dell'anno {selectedYear} ha superato il limite. Il regime forfettario cesserà l'anno successivo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};