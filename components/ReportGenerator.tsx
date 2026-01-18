import React from 'react';
import { Client, Invoice, PaymentStatus, GlobalTaxConfig } from '../types';
import { Button } from './Button';
import { Printer } from 'lucide-react';

interface ReportGeneratorProps {
  client: Client;
  invoices: Invoice[];
  taxConfig: GlobalTaxConfig;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ client, invoices, taxConfig }) => {
  const currentYear = new Date().getFullYear();
  
  const paidInvoices = invoices
    .filter(i => i.status === PaymentStatus.PAID && new Date(i.paymentDate || '').getFullYear() === currentYear)
    .sort((a, b) => new Date(a.paymentDate!).getTime() - new Date(b.paymentDate!).getTime());

  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
  const taxableIncome = totalRevenue * client.profitabilityCoefficient;
  const grossTax = taxableIncome * client.taxRate;
  const estimatedInps = taxableIncome * taxConfig.standardInpsRate;
  const netIncome = totalRevenue - grossTax - estimatedInps;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Report Fiscale {currentYear}</h2>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Stampa / PDF
        </Button>
      </div>

      {/* Printable Area */}
      <div className="bg-white p-8 shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <div className="border-b-2 border-indigo-600 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Prospetto Contabile</h1>
            <p className="text-gray-500 mt-1">Regime Forfettario (L. 190/2014)</p>
          </div>
          <div className="text-right">
             <h3 className="font-bold text-gray-900">{client.name}</h3>
             <p className="text-sm text-gray-600">C.F./P.IVA: {client.fiscalCode}</p>
             <p className="text-sm text-gray-600">Codice ATECO: {client.atecoCode}</p>
             <p className="text-sm text-gray-600">Coefficiente: {(client.profitabilityCoefficient * 100).toFixed(0)}%</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Riepilogo Fiscale {currentYear}</h4>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
             <div className="flex justify-between py-2 border-b border-gray-100">
               <span className="text-gray-700">Totale Incassato (Cassa)</span>
               <span className="font-bold text-gray-900">€ {totalRevenue.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
             <div className="flex justify-between py-2 border-b border-gray-100">
               <span className="text-gray-700">Reddito Imponibile</span>
               <span className="font-bold text-gray-900">€ {taxableIncome.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
             <div className="flex justify-between py-2 border-b border-gray-100">
               <span className="text-gray-700">Imposta Sostitutiva ({(client.taxRate * 100).toFixed(0)}%)</span>
               <span className="font-bold text-red-600">- € {grossTax.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
             <div className="flex justify-between py-2 border-b border-gray-100">
               <span className="text-gray-700">Stima INPS ({(taxConfig.standardInpsRate * 100).toFixed(2)}%)</span>
               <span className="font-bold text-red-600">- € {estimatedInps.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
             <div className="flex justify-between py-2 pt-4 font-bold text-lg text-indigo-700 col-span-2">
               <span>Netto Stimato</span>
               <span>€ {netIncome.toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
             </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div>
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Dettaglio Movimenti Incassati</h4>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Data Incasso</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">N. Fattura</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paidInvoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Nessun incasso registrato nell'anno corrente.</td>
                </tr>
              ) : (
                paidInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2 text-gray-900">{new Date(inv.paymentDate!).toLocaleDateString('it-IT')}</td>
                    <td className="px-4 py-2 text-gray-600">{inv.number}</td>
                    <td className="px-4 py-2 text-gray-600">{inv.clientName}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">€ {inv.amount.toLocaleString('it-IT', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>Documento generato automaticamente il {new Date().toLocaleDateString('it-IT')}</p>
          <p>Uso interno studio professionale - Stima non vincolante ai fini fiscali</p>
        </div>
      </div>
    </div>
  );
};