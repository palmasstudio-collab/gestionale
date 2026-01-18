import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Invoice, Client, PaymentStatus } from '../types';
import { Card } from './Card';
import { TrendingUp, AlertTriangle, Wallet, PieChart, Calendar } from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  client: Client;
  annualRevenueLimit: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ invoices, client, annualRevenueLimit }) => {
  const currentYear = new Date().getFullYear();
  
  // Available Years logic
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    invoices.forEach(inv => {
      if (inv.paymentDate) years.add(new Date(inv.paymentDate).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const stats = useMemo(() => {
    const paidInvoices = invoices.filter(i => i.status === PaymentStatus.PAID && new Date(i.paymentDate || '').getFullYear() === selectedYear);
    const pendingInvoices = invoices.filter(i => i.status === PaymentStatus.PENDING); // Pending are timeless/current usually, or we can filter by date if they have one
    
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const pendingRevenue = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const progressPercentage = (totalRevenue / annualRevenueLimit) * 100;
    
    // Monthly data for chart
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthName = new Date(selectedYear, i).toLocaleString('it-IT', { month: 'short' });
      const monthRevenue = paidInvoices
        .filter(inv => new Date(inv.paymentDate!).getMonth() === i)
        .reduce((sum, inv) => sum + inv.amount, 0);
      return { name: monthName, revenue: monthRevenue };
    });

    return {
      totalRevenue,
      pendingRevenue,
      progressPercentage,
      monthlyData,
      remaining: annualRevenueLimit - totalRevenue
    };
  }, [invoices, client, annualRevenueLimit, selectedYear]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Panoramica situazione fiscale.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Incassato {selectedYear}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€ {stats.totalRevenue.toLocaleString('it-IT')}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-full">
              <Wallet className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Da Incassare (Totale)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€ {stats.pendingRevenue.toLocaleString('it-IT')}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-full">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
           <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Residuo Limite 85k</p>
              <p className={`text-2xl font-bold mt-1 ${stats.remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                € {stats.remaining.toLocaleString('it-IT')}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full">
              <PieChart className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 ${stats.progressPercentage > 85 ? 'border-l-red-500' : 'border-l-blue-500'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Utilizzo Plafond</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.progressPercentage.toFixed(1)}%</p>
            </div>
            <div className={`p-3 rounded-full ${stats.progressPercentage > 85 ? 'bg-red-50' : 'bg-blue-50'}`}>
              <AlertTriangle className={`w-6 h-6 ${stats.progressPercentage > 85 ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={`Andamento Mensile ${selectedYear}`} className="lg:col-span-2 h-96">
          <div className="h-full w-full pt-4">
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tickFormatter={(value) => `€${value/1000}k`} tick={{fontSize: 12}} />
                <Tooltip 
                  formatter={(value: number) => [`€ ${value.toLocaleString('it-IT')}`, 'Incassato']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                   {stats.monthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.revenue > 0 ? '#4f46e5' : '#e5e7eb'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Stato Regime" className="h-96">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Limite Ricavi (85k)</span>
                <span className="font-semibold">{stats.progressPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${stats.progressPercentage > 90 ? 'bg-red-600' : 'bg-indigo-600'}`} 
                  style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Prossime scadenze {selectedYear}</h4>
              <div className="flex items-start space-x-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">30 Giugno</p>
                  <p className="text-gray-500">Saldo imposta anno prec.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">30 Novembre</p>
                  <p className="text-gray-500">Secondo acconto imposta</p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Nota:</strong> I costi reali non sono deducibili. Viene applicato il coefficiente di redditività del 
                    <strong> {(client.profitabilityCoefficient * 100).toFixed(0)}%</strong>.
                </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};