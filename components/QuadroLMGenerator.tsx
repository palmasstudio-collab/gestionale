import React, { useState, useMemo } from 'react';
import { Client, Invoice, PaymentStatus, InpsPayment } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { FileCheck, Clipboard, CornerDownRight, Info } from 'lucide-react';

interface QuadroLMGeneratorProps {
  client: Client;
  invoices: Invoice[];
  inpsPayments: InpsPayment[];
}

export const QuadroLMGenerator: React.FC<QuadroLMGeneratorProps> = ({ client, invoices, inpsPayments }) => {
  const currentYear = new Date().getFullYear();
  
  // Calculate available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    
    invoices.forEach(inv => {
      if (inv.paymentDate) {
        years.add(new Date(inv.paymentDate).getFullYear());
      }
    });

    inpsPayments.forEach(p => {
      years.add(new Date(p.date).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, inpsPayments, currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Get activity configuration
  const activity = ATECO_ACTIVITIES.find(a => a.id === client.activityId);

  // 1. Calculate Revenue (LM22/LM27 - Componenti Positivi)
  // Strict Cash Basis: Date of payment must be in the selected year
  const paidInvoices = invoices.filter(i => 
    i.status === PaymentStatus.PAID && 
    i.paymentDate && 
    new Date(i.paymentDate).getFullYear() === selectedYear
  );

  const revenue = paidInvoices.reduce((sum, i) => {
    // If hasCassa AND cassaIsTaxable (e.g. Rivalsa INPS 4%), Revenue = Taxable + Cassa (which is usually Total Amount, assuming no expenses)
    // If hasCassa AND !cassaIsTaxable (e.g. Integrativo ENPAP 2%), Revenue = Taxable Amount only.
    // Fallback: If no activity config, assume Total Amount.
    
    if (activity?.hasCassa) {
      if (activity.cassaIsTaxable) {
         // Rivalsa counts as revenue
         return sum + (i.taxableAmount + (i.cassaAmount || 0));
      } else {
         // Integrativo excluded from revenue
         return sum + i.taxableAmount;
      }
    }
    
    // Default / No Cassa
    return sum + i.amount;
  }, 0);

  // Calculate Total Cassa Collected (Informational)
  const totalCassaCollected = paidInvoices.reduce((sum, i) => sum + (i.cassaAmount || 0), 0);

  // 2. Calculate Gross Income (Reddito Lordo)
  const grossIncome = revenue * client.profitabilityCoefficient;

  // 3. Deductible Contributions (LM37)
  // Cash Basis: Payments made in the selected year
  const deductiblePaymentsDetail = inpsPayments
    .filter(p => new Date(p.date).getFullYear() === selectedYear);
  
  const deductibleInps = deductiblePaymentsDetail.reduce((sum, p) => sum + p.amount, 0);

  // 4. Net Taxable Income (LM38)
  // Cannot be negative
  const taxableIncome = Math.max(0, grossIncome - deductibleInps);

  // 5. Tax (LM39)
  const tax = taxableIncome * client.taxRate;

  // Helper to copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quadro LM (Redditi PF)</h2>
          <p className="text-gray-500">Dati calcolati per la compilazione della dichiarazione dei redditi {selectedYear + 1} (anno fiscale {selectedYear}).</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Anno Fiscale</label>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Simulation */}
        <Card className="lg:col-span-2 border-t-4 border-t-indigo-600">
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
             <div>
               <h3 className="text-lg font-bold text-gray-900">Sezione II - Regime Forfettario</h3>
               <p className="text-sm text-gray-500">Determinazione del reddito e dell'imposta ({selectedYear})</p>
             </div>
             <FileCheck className="w-8 h-8 text-indigo-200" />
           </div>

           <div className="space-y-1">
             {/* HEADER TABLE */}
             <div className="grid grid-cols-12 bg-gray-50 py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-t-md">
               <div className="col-span-2">Rigo</div>
               <div className="col-span-6">Descrizione</div>
               <div className="col-span-4 text-right">Valore (€)</div>
             </div>

             {/* ROW LM22 */}
             <div className="grid grid-cols-12 items-center py-3 px-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
               <div className="col-span-2 font-mono font-bold text-indigo-700">LM22</div>
               <div className="col-span-6 text-sm text-gray-700">
                 Componenti positivi (Fatturato incassato)
                 <div className="text-xs text-gray-400 font-normal">Cod. ATECO {client.atecoCode} {activity?.hasCassa && !activity.cassaIsTaxable ? '(Escluso contr. integrativo)' : ''}</div>
               </div>
               <div className="col-span-4 text-right flex items-center justify-end gap-2">
                 <span className="font-medium text-lg text-gray-900">{revenue.toLocaleString('it-IT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                 <button onClick={() => copyToClipboard(revenue.toFixed(0))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                   <Clipboard className="w-3 h-3 text-gray-500" />
                 </button>
               </div>
             </div>

             {/* ROW INFO CASSA (If Applicable) */}
             {activity?.hasCassa && (
                <div className="grid grid-cols-12 items-center py-2 px-3 border-b border-gray-100 bg-blue-50/20 text-xs text-gray-500 animate-fade-in">
                    <div className="col-span-2 font-mono font-bold text-blue-400">INFO</div>
                    <div className="col-span-6 flex items-center">
                        <Info className="w-3 h-3 mr-2 text-blue-400" />
                        <span>{activity.cassaLabel || 'Contributo'} incassato (Statistico)</span>
                    </div>
                    <div className="col-span-4 text-right pr-8 text-blue-600 font-medium">
                        € {totalCassaCollected.toLocaleString('it-IT', {minimumFractionDigits: 2})}
                    </div>
                </div>
             )}

             {/* ROW LM34 */}
             <div className="grid grid-cols-12 items-center py-3 px-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
               <div className="col-span-2 font-mono font-bold text-indigo-700">LM34</div>
               <div className="col-span-6 text-sm text-gray-700">
                 Reddito lordo
                 <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                   Coeff. {(client.profitabilityCoefficient * 100).toFixed(0)}%
                 </span>
               </div>
               <div className="col-span-4 text-right flex items-center justify-end gap-2">
                 <span className="font-medium text-lg text-gray-900">{grossIncome.toLocaleString('it-IT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                 <button onClick={() => copyToClipboard(grossIncome.toFixed(0))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                   <Clipboard className="w-3 h-3 text-gray-500" />
                 </button>
               </div>
             </div>

             {/* ROW LM37 */}
             <div className="grid grid-cols-12 items-center py-3 px-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group bg-red-50/30">
               <div className="col-span-2 font-mono font-bold text-indigo-700">LM37</div>
               <div className="col-span-6 text-sm text-gray-700">
                 Contributi previdenziali e assistenziali
                 <div className="text-xs text-gray-400 font-normal">Versati nell'anno {selectedYear}</div>
               </div>
               <div className="col-span-4 text-right flex items-center justify-end gap-2">
                 <span className="font-medium text-lg text-red-700">({deductibleInps.toLocaleString('it-IT', {minimumFractionDigits: 0, maximumFractionDigits: 0})})</span>
                 <button onClick={() => copyToClipboard(deductibleInps.toFixed(0))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                   <Clipboard className="w-3 h-3 text-gray-500" />
                 </button>
               </div>
             </div>

             {/* DETAIL ROWS FOR LM37 */}
             {deductiblePaymentsDetail.map(p => (
                <div key={p.id} className="grid grid-cols-12 items-center py-2 px-3 border-b border-gray-100 bg-red-50/10 text-xs text-gray-500 animate-fade-in">
                    <div className="col-span-2"></div>
                    <div className="col-span-6 pl-4 flex items-center">
                        <CornerDownRight className="w-3 h-3 mr-2 text-gray-400" />
                        <span className="font-medium">{new Date(p.date).toLocaleDateString('it-IT')}</span>
                        <span className="mx-1">-</span>
                        <span>{p.description}</span>
                    </div>
                    <div className="col-span-4 text-right pr-8 text-gray-500">
                        € {p.amount.toLocaleString('it-IT', {minimumFractionDigits: 2})}
                    </div>
                </div>
             ))}

             {/* ROW LM38 */}
             <div className="grid grid-cols-12 items-center py-4 px-3 border-b-2 border-gray-200 hover:bg-gray-50 transition-colors group bg-indigo-50/30">
               <div className="col-span-2 font-mono font-bold text-indigo-700">LM38</div>
               <div className="col-span-6 text-sm font-bold text-gray-900">
                 Reddito netto imponibile
               </div>
               <div className="col-span-4 text-right flex items-center justify-end gap-2">
                 <span className="font-bold text-xl text-indigo-900">{taxableIncome.toLocaleString('it-IT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                 <button onClick={() => copyToClipboard(taxableIncome.toFixed(0))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                   <Clipboard className="w-3 h-3 text-gray-500" />
                 </button>
               </div>
             </div>

             {/* ROW LM39 */}
             <div className="grid grid-cols-12 items-center py-3 px-3 hover:bg-gray-50 transition-colors group">
               <div className="col-span-2 font-mono font-bold text-indigo-700">LM39</div>
               <div className="col-span-6 text-sm text-gray-700">
                 Imposta sostitutiva
                 <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                   Aliquota {(client.taxRate * 100).toFixed(0)}%
                 </span>
               </div>
               <div className="col-span-4 text-right flex items-center justify-end gap-2">
                 <span className="font-bold text-lg text-gray-900">{tax.toLocaleString('it-IT', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                 <button onClick={() => copyToClipboard(tax.toFixed(0))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                   <Clipboard className="w-3 h-3 text-gray-500" />
                 </button>
               </div>
             </div>
           </div>
        </Card>

        {/* Info & Warnings */}
        <div className="space-y-6">
           <Card title="Dettaglio Fonti Dati">
             <div className="space-y-4 text-sm">
               <div>
                 <p className="font-semibold text-gray-700">Fatturato (LM22)</p>
                 <p className="text-gray-500">{paidInvoices.length} fatture incassate nel {selectedYear}.</p>
               </div>
               <div>
                 <p className="font-semibold text-gray-700">Contributi (LM37)</p>
                 <p className="text-gray-500">Somma dei versamenti registrati nel modulo "Contributi Versati" con data pagamento nel {selectedYear}.</p>
               </div>
               
               {activity?.hasCassa && (
                 <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-800 mt-2">
                   <strong>Nota Cassa ({activity.inpsType}):</strong>
                   <br/>
                   {activity.cassaIsTaxable 
                     ? "La Rivalsa INPS è inclusa nel reddito imponibile (LM22)." 
                     : "Il Contributo Integrativo è escluso dal reddito imponibile (LM22)."
                   }
                   <br/>
                   <span className="text-blue-600 mt-1 block">Totale incassato nell'anno: € {totalCassaCollected.toLocaleString('it-IT')}</span>
                 </div>
               )}
             </div>
           </Card>
        </div>
      </div>
    </div>
  );
};