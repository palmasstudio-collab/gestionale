
import React, { useState, useEffect, useRef } from 'react';
import { Invoice, PaymentStatus, Client, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Check, X, Calendar, DollarSign, Calculator, Paperclip, FileText } from 'lucide-react';

interface InvoiceManagerProps {
  client: Client;
  allInvoices: Invoice[];
  setAllInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
}

// Helper to convert base64 to blob
const base64ToBlob = (base64: string) => {
  try {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("Error converting base64 to blob", e);
    return null;
  }
};

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ client, allInvoices, setAllInvoices, onLog }) => {
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Find current client and their activity for configuration using the live client prop
  const activityConfig = ATECO_ACTIVITIES.find(a => a.id === client.activityId);

  // Default status is now PAID, assuming invoice is issued upon payment
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    status: PaymentStatus.PAID,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0], // Sync payment date immediately
    taxableAmount: 0,
    cassaAmount: 0,
    amount: 0,
    fileName: undefined,
    attachment: undefined
  });

  // Auto-calculate totals when taxable amount changes
  useEffect(() => {
    if (activityConfig && newInvoice.taxableAmount !== undefined) {
      let calculatedCassa = 0;
      
      if (activityConfig.hasCassa && activityConfig.cassaRate) {
        calculatedCassa = newInvoice.taxableAmount * activityConfig.cassaRate;
      }
      
      setNewInvoice(prev => ({
        ...prev,
        cassaAmount: calculatedCassa,
        amount: (prev.taxableAmount || 0) + calculatedCassa
      }));
    } else {
      // Fallback if no activity selected, treat amount as just taxable
       setNewInvoice(prev => ({
        ...prev,
        cassaAmount: 0,
        amount: prev.taxableAmount || 0
      }));
    }
  }, [newInvoice.taxableAmount, activityConfig]);

  // Keep paymentDate synced with invoice date when creating new invoice (since status is PAID)
  useEffect(() => {
    if (isAdding && newInvoice.status === PaymentStatus.PAID) {
        setNewInvoice(prev => ({
            ...prev,
            paymentDate: prev.date
        }));
    }
  }, [newInvoice.date, isAdding]);

  const clientInvoices = allInvoices.filter(inv => inv.clientId === client.id);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewInvoice(prev => ({
          ...prev,
          fileName: file.name,
          attachment: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.number || !newInvoice.clientName || !newInvoice.date) return;

    const invoice: Invoice = {
      id: Date.now().toString(),
      clientId: client.id,
      number: newInvoice.number,
      clientName: newInvoice.clientName,
      date: newInvoice.date,
      status: newInvoice.status as PaymentStatus,
      // If paid, use paymentDate (which defaults to date), otherwise undefined
      paymentDate: newInvoice.status === PaymentStatus.PAID ? (newInvoice.paymentDate || newInvoice.date) : undefined,
      
      // Amounts
      taxableAmount: Number(newInvoice.taxableAmount),
      cassaAmount: Number(newInvoice.cassaAmount),
      amount: Number(newInvoice.amount), // Total
      
      // Attachment
      attachment: newInvoice.attachment,
      fileName: newInvoice.fileName
    };

    setAllInvoices(prev => [...prev, invoice]);
    onLog('CREATE', 'INVOICE', `Creata fattura n. ${invoice.number} per ${invoice.clientName} (€ ${invoice.amount})`, client.id);
    setIsAdding(false);
    
    // Reset form
    setNewInvoice({
      status: PaymentStatus.PAID,
      date: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      number: '',
      clientName: '',
      taxableAmount: 0,
      cassaAmount: 0,
      amount: 0,
      fileName: undefined,
      attachment: undefined
    });
  };

  const toggleStatus = (id: string) => {
    setAllInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        const newStatus = inv.status === PaymentStatus.PAID ? PaymentStatus.PENDING : PaymentStatus.PAID;
        onLog('STATUS_CHANGE', 'INVOICE', `Cambio stato fattura n. ${inv.number} in ${newStatus}`, client.id);
        return {
          ...inv,
          status: newStatus,
          paymentDate: newStatus === PaymentStatus.PAID ? new Date().toISOString().split('T')[0] : undefined
        };
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
  
  const downloadAttachment = (inv: Invoice) => {
    if (!inv.attachment) return;
    
    // Use Blob approach for better browser support/stability
    const blob = base64ToBlob(inv.attachment);
    if (!blob) {
      alert("Errore nel file allegato");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = inv.fileName || `Fattura_${inv.number}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Increased timeout to ensure download starts before cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!activityConfig) {
    return (
       <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 flex flex-col items-start gap-2">
         <p className="font-bold">⚠️ Configurazione attività non trovata.</p>
         <p className="text-sm">Sembra che l'attività ATECO non sia stata selezionata o salvata correttamente per <strong>{client.name}</strong>.</p>
         <p className="text-sm">Per favore, torna in <strong>Anagrafica</strong>, seleziona l'attività dal menu a tendina e clicca su <strong>Salva Modifiche</strong>.</p>
       </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900">Gestione Fatture</h2>
           <p className="text-sm text-gray-500">Configurazione: {activityConfig.code} - {activityConfig.vatRegime}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Fattura
        </Button>
      </div>

      {isAdding && (
        <Card title="Nuova Fattura" className="mb-6 animate-fade-in border-t-4 border-t-indigo-500">
          <form onSubmit={handleAddInvoice} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
              <input 
                type="text" 
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                placeholder="es. 10/2024"
                value={newInvoice.number || ''}
                onChange={e => setNewInvoice({...newInvoice, number: e.target.value})}
              />
            </div>
            <div className="lg:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente Finale</label>
              <input 
                type="text" 
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                placeholder="Nome Cliente"
                value={newInvoice.clientName || ''}
                onChange={e => setNewInvoice({...newInvoice, clientName: e.target.value})}
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Incasso/Emissione</label>
              <input 
                type="date" 
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                value={newInvoice.date || ''}
                onChange={e => setNewInvoice({...newInvoice, date: e.target.value})}
              />
            </div>

            {/* DYNAMIC CALCULATION ROW */}
            <div className="lg:col-span-12 mt-2 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-lg">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Compenso / Imponibile (€)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-lg font-medium"
                    placeholder="0.00"
                    value={newInvoice.taxableAmount || ''}
                    onChange={e => setNewInvoice({...newInvoice, taxableAmount: Number(e.target.value)})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Inserisci l'importo del servizio</p>
               </div>

               {activityConfig.hasCassa ? (
                 <div className="flex flex-col justify-end opacity-75">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                       {activityConfig.cassaLabel || 'Contributo'} ({(activityConfig.cassaRate! * 100)}%)
                    </label>
                    <div className="w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-lg font-medium text-gray-600">
                      € {newInvoice.cassaAmount?.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Calcolato automaticamente</p>
                 </div>
               ) : (
                 <div className="flex flex-col justify-end opacity-50">
                   <p className="text-xs text-gray-400 text-center mt-6">Nessuna cassa/rivalsa prevista</p>
                 </div>
               )}

               <div className="flex flex-col justify-end">
                  <label className="block text-sm font-bold text-indigo-700 mb-1">Totale Documento (€)</label>
                  <div className="w-full rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xl font-bold text-indigo-700">
                    € {newInvoice.amount?.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-xs text-indigo-500 mt-1">Totale da incassare (Netto a pagare)</p>
               </div>
            </div>

            {/* FILE UPLOAD */}
            <div className="lg:col-span-12">
               <label className="block text-sm font-medium text-gray-700 mb-1">Allegato Fattura (PDF)</label>
               <div className="flex items-center gap-2">
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   accept=".pdf,image/*"
                   onChange={handleFileChange}
                   className="hidden"
                 />
                 <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} size="sm">
                   <Paperclip className="w-4 h-4 mr-2" />
                   {newInvoice.fileName ? 'Cambia File' : 'Carica PDF'}
                 </Button>
                 {newInvoice.fileName && (
                   <span className="text-sm text-gray-600 flex items-center bg-gray-100 px-2 py-1 rounded">
                     {newInvoice.fileName}
                     <button 
                       type="button"
                       className="ml-2 text-gray-400 hover:text-red-500"
                       onClick={() => setNewInvoice(prev => ({ ...prev, fileName: undefined, attachment: undefined }))}
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}
               </div>
            </div>

            {/* VAT INFO */}
            <div className="lg:col-span-12 text-xs text-gray-500 italic text-center mt-2">
               * Regime IVA: {activityConfig.vatRegime}
               {activityConfig.hasCassa && activityConfig.cassaIsTaxable && (
                 <span className="ml-2 text-amber-600 font-medium">(La rivalsa concorre al reddito imponibile)</span>
               )}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Imponibile</th>
                {activityConfig.hasCassa && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activityConfig.cassaLabel?.split(' ')[0] || 'Cassa'}
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">Totale</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Doc</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientInvoices.length === 0 ? (
                 <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <p>Nessuna fattura presente per questo cliente. Crea la prima!</p>
                  </td>
                </tr>
              ) : (
                clientInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === PaymentStatus.PAID ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(inv.date).toLocaleDateString('it-IT')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.clientName}</td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      € {inv.taxableAmount?.toFixed(2) || inv.amount.toFixed(2)}
                    </td>
                    
                    {activityConfig.hasCassa && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {inv.cassaAmount ? `€ ${inv.cassaAmount.toFixed(2)}` : '-'}
                      </td>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      € {inv.amount.toFixed(2)}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                       {inv.attachment ? (
                         <button onClick={() => downloadAttachment(inv)} className="text-indigo-600 hover:text-indigo-800" title={inv.fileName}>
                           <FileText className="w-5 h-5" />
                         </button>
                       ) : (
                         <span className="text-gray-300">-</span>
                       )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                      <button 
                        onClick={() => toggleStatus(inv.id)}
                        className={`p-1 rounded-md ${inv.status === PaymentStatus.PAID ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={inv.status === PaymentStatus.PAID ? "Segna come da incassare" : "Segna come incassata"}
                      >
                         <DollarSign className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => deleteInvoice(inv.id)}
                        className="p-1 rounded-md text-red-600 hover:bg-red-50"
                        title="Elimina"
                      >
                        <X className="w-5 h-5" />
                      </button>
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
