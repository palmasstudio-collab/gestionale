
import React, { useState, useEffect, useRef } from 'react';
import { Invoice, PaymentStatus, Client, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Check, X, Calendar, DollarSign, Calculator, Paperclip, FileText, CloudSync } from 'lucide-react';
import { syncInvoiceToSpreadsheet, handleAuthClick } from '../utils/googleDrive';

interface InvoiceManagerProps {
  client: Client;
  allInvoices: Invoice[];
  setAllInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
}

const base64ToBlob = (base64: string) => {
  try {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], { type: mime });
  } catch (e) { return null; }
};

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ client, allInvoices, setAllInvoices, onLog }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const activityConfig = ATECO_ACTIVITIES.find(a => a.id === client.activityId);

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    status: PaymentStatus.PAID,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    taxableAmount: 0,
    cassaAmount: 0,
    amount: 0,
    fileName: undefined,
    attachment: undefined
  });

  useEffect(() => {
    if (activityConfig && newInvoice.taxableAmount !== undefined) {
      let calculatedCassa = activityConfig.hasCassa && activityConfig.cassaRate ? newInvoice.taxableAmount * activityConfig.cassaRate : 0;
      setNewInvoice(prev => ({ ...prev, cassaAmount: calculatedCassa, amount: (prev.taxableAmount || 0) + calculatedCassa }));
    }
  }, [newInvoice.taxableAmount, activityConfig]);

  const clientInvoices = allInvoices.filter(inv => inv.clientId === client.id);

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.number || !newInvoice.clientName || !newInvoice.date) return;

    const invoice: Invoice = {
      id: Date.now().toString(),
      clientId: client.id,
      number: newInvoice.number,
      clientName: newInvoice.clientName,
      date: newInvoice.date,
      status: newInvoice.status as PaymentStatus,
      paymentDate: newInvoice.status === PaymentStatus.PAID ? (newInvoice.paymentDate || newInvoice.date) : undefined,
      taxableAmount: Number(newInvoice.taxableAmount),
      cassaAmount: Number(newInvoice.cassaAmount),
      amount: Number(newInvoice.amount),
      attachment: newInvoice.attachment,
      fileName: newInvoice.fileName
    };

    setAllInvoices(prev => [...prev, invoice]);
    onLog('CREATE', 'INVOICE', `Creata fattura n. ${invoice.number} per ${invoice.clientName}`, client.id);

    // --- SINCRONIZZAZIONE GOOGLE SHEETS ---
    if (client.spreadsheetId) {
      setIsSyncing(true);
      try {
        const isDriveAuth = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;
        if (!isDriveAuth) await handleAuthClick();
        await syncInvoiceToSpreadsheet(client.spreadsheetId, invoice);
      } catch (err) {
        console.error("Sincronizzazione fallita:", err);
      } finally {
        setIsSyncing(false);
      }
    }

    setIsAdding(false);
    setNewInvoice({
      status: PaymentStatus.PAID, date: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0], number: '', clientName: '',
      taxableAmount: 0, cassaAmount: 0, amount: 0, fileName: undefined, attachment: undefined
    });
  };

  const toggleStatus = (id: string) => {
    setAllInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        const newStatus = inv.status === PaymentStatus.PAID ? PaymentStatus.PENDING : PaymentStatus.PAID;
        onLog('STATUS_CHANGE', 'INVOICE', `Cambio stato fattura n. ${inv.number}`, client.id);
        return { ...inv, status: newStatus, paymentDate: newStatus === PaymentStatus.PAID ? new Date().toISOString().split('T')[0] : undefined };
      }
      return inv;
    }));
  };

  const deleteInvoice = (id: string) => {
    const inv = allInvoices.find(i => i.id === id);
    if (inv && window.confirm('Sei sicuro di voler eliminare questa fattura?')) {
      setAllInvoices(prev => prev.filter(inv => inv.id !== id));
      onLog('DELETE', 'INVOICE', `Eliminata fattura n. ${inv.number}`, client.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900">Gestione Fatture</h2>
           <p className="text-sm text-gray-500">Configurazione: {activityConfig?.code || 'N.D.'}</p>
        </div>
        <div className="flex items-center gap-2">
           {isSyncing && (
             <span className="text-xs text-indigo-600 flex items-center animate-pulse mr-2">
               <CloudSync className="w-4 h-4 mr-1" /> Sincro Excel...
             </span>
           )}
           <Button onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card title="Nuova Fattura" className="mb-6 animate-fade-in border-t-4 border-t-indigo-500">
          <form onSubmit={handleAddInvoice} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
              <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="es. 10/2024" value={newInvoice.number || ''} onChange={e => setNewInvoice({...newInvoice, number: e.target.value})} />
            </div>
            <div className="lg:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente Finale</label>
              <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="Nome Cliente" value={newInvoice.clientName || ''} onChange={e => setNewInvoice({...newInvoice, clientName: e.target.value})} />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" required className="w-full rounded-md border-gray-300 border p-2" value={newInvoice.date || ''} onChange={e => setNewInvoice({...newInvoice, date: e.target.value})} />
            </div>

            <div className="lg:col-span-12 bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Compenso (€)</label>
                  <input type="number" required step="0.01" className="w-full rounded-md border-gray-300 border p-2 text-lg" value={newInvoice.taxableAmount || ''} onChange={e => setNewInvoice({...newInvoice, taxableAmount: Number(e.target.value)})} />
               </div>
               <div className="flex flex-col justify-end">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{activityConfig?.cassaLabel || 'Cassa'}</label>
                  <div className="w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-lg text-gray-600">€ {newInvoice.cassaAmount?.toFixed(2) || '0.00'}</div>
               </div>
               <div className="flex flex-col justify-end">
                  <label className="block text-sm font-bold text-indigo-700 mb-1">Totale Documento (€)</label>
                  <div className="w-full rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xl font-bold text-indigo-700">€ {newInvoice.amount?.toFixed(2) || '0.00'}</div>
               </div>
            </div>

            <div className="lg:col-span-12 flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>Annulla</Button>
              <Button type="submit">Salva Fattura</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numero</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">Totale</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientInvoices.length === 0 ? (
                 <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nessuna fattura.</td></tr>
              ) : (
                clientInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === PaymentStatus.PAID ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(inv.date).toLocaleDateString('it-IT')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{inv.clientName}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">€ {inv.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium flex justify-end gap-2">
                      <button onClick={() => toggleStatus(inv.id)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><DollarSign className="w-4 h-4" /></button>
                      <button onClick={() => deleteInvoice(inv.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
