
import React from 'react';
import { Client, Invoice, PaymentStatus } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Users, TrendingUp, AlertTriangle, ArrowRight, UserPlus, Trash2 } from 'lucide-react';

interface StudioDashboardProps {
  clients: Client[];
  invoices: Invoice[];
  onSelectClient: (clientId: string) => void;
  onAddClient: () => void;
  onDeleteClient: (clientId: string) => void;
  annualRevenueLimit: number;
}

export const StudioDashboard: React.FC<StudioDashboardProps> = ({ clients, invoices, onSelectClient, onAddClient, onDeleteClient, annualRevenueLimit }) => {
  const currentYear = new Date().getFullYear();

  const getClientStats = (clientId: string) => {
    const clientInvoices = invoices.filter(inv => inv.clientId === clientId && inv.status === PaymentStatus.PAID && new Date(inv.paymentDate || '').getFullYear() === currentYear);
    const revenue = clientInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    return revenue;
  };

  const totalStudioRevenue = clients.reduce((sum, client) => sum + getClientStats(client.id), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panoramica Studio Palmas</h2>
          <p className="text-gray-500">Gestione centralizzata clienti forfettari.</p>
        </div>
        <Button onClick={onAddClient}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuovo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Clienti Attivi</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{clients.length}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-full">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Volume Affari Gestito ({currentYear})</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€ {totalStudioRevenue.toLocaleString('it-IT')}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
           <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avvisi / Scadenze</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-full">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Portafoglio Clienti" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codice ATECO</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatturato {currentYear}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plafond Utilizzato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map(client => {
                const revenue = getClientStats(client.id);
                const percentage = (revenue / annualRevenueLimit) * 100;
                
                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onSelectClient(client.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{client.name}</div>
                          <div className="text-sm text-gray-500">{client.fiscalCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.atecoCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">€ {revenue.toLocaleString('it-IT')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                        <div 
                          className={`h-2.5 rounded-full ${percentage > 85 ? 'bg-red-600' : 'bg-green-600'}`} 
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 mt-1 block">{percentage.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Elimina cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectClient(client.id); }}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center font-semibold"
                        >
                          Gestisci <ArrowRight className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
