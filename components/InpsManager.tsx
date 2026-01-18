
import React, { useState, useRef } from 'react';
import { InpsPayment, LogActionType, LogEntityType } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Trash2, Landmark, Paperclip, FileText, X } from 'lucide-react';

interface InpsManagerProps {
  clientId: string;
  payments: InpsPayment[];
  setPayments: React.Dispatch<React.SetStateAction<InpsPayment[]>>;
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

export const InpsManager: React.FC<InpsManagerProps> = ({ clientId, payments, setPayments, onLog }) => {
  const [newPayment, setNewPayment] = useState<Partial<InpsPayment>>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    fileName: undefined,
    attachment: undefined
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientPayments = payments.filter(p => p.clientId === clientId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const currentYear = new Date().getFullYear();
  const totalPaidCurrentYear = clientPayments
    .filter(p => new Date(p.date).getFullYear() === currentYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPayment(prev => ({
          ...prev,
          fileName: file.name,
          attachment: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.date || !newPayment.amount) return;

    const payment: InpsPayment = {
      id: Date.now().toString(),
      clientId,
      date: newPayment.date,
      amount: Number(newPayment.amount),
      description: newPayment.description || 'Versamento INPS',
      attachment: newPayment.attachment,
      fileName: newPayment.fileName
    };

    setPayments(prev => [...prev, payment]);
    onLog('CREATE', 'PAYMENT', `Registrato versamento € ${payment.amount} (${payment.description})`, clientId);
    
    // Reset form
    setNewPayment({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      fileName: undefined,
      attachment: undefined
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deletePayment = (id: string) => {
    if (window.confirm('Eliminare questo pagamento?')) {
      const p = payments.find(x => x.id === id);
      setPayments(prev => prev.filter(p => p.id !== id));
      onLog('DELETE', 'PAYMENT', `Eliminato versamento € ${p?.amount}`, clientId);
    }
  };

  const downloadAttachment = (p: InpsPayment) => {
    if (!p.attachment) return;
    
    const blob = base64ToBlob(p.attachment);
    if (!blob) {
      alert("Errore nel file allegato");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = p.fileName || `Ricevuta_INPS_${p.date}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Increased timeout to ensure download starts before cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Contributi</h2>
          <p className="text-sm text-gray-500">Totale versato {currentYear}: <strong>€ {totalPaidCurrentYear.toLocaleString('it-IT')}</strong></p>
        </div>
      </div>

      <Card title="Registra Nuovo Versamento" className="border-t-4 border-t-red-600">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Pagamento</label>
              <input 
                type="date"
                required
                className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
                value={newPayment.date}
                onChange={e => setNewPayment({...newPayment, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importo (€)</label>
              <input 
                type="number"
                step="0.01"
                required
                className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
                value={newPayment.amount || ''}
                onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <input 
                type="text"
                className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
                placeholder="es. Saldo 2023, Acconto..."
                value={newPayment.description}
                onChange={e => setNewPayment({...newPayment, description: e.target.value})}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex-1">
               <label className="block text-sm font-medium text-gray-700 mb-1">Allegato (Ricevuta F24)</label>
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
                   {newPayment.fileName ? 'Cambia File' : 'Carica PDF'}
                 </Button>
                 {newPayment.fileName && (
                   <span className="text-sm text-gray-600 flex items-center bg-gray-100 px-2 py-1 rounded">
                     {newPayment.fileName}
                     <button 
                       type="button"
                       className="ml-2 text-gray-400 hover:text-red-500"
                       onClick={() => setNewPayment(prev => ({ ...prev, fileName: undefined, attachment: undefined }))}
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}
               </div>
             </div>
             <div className="flex items-end">
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi
                </Button>
             </div>
          </div>
        </form>
      </Card>

      <Card title="Storico Versamenti">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrizione</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Allegato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nessun versamento registrato.</td>
                </tr>
              ) : (
                clientPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(p.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      € {p.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                       {p.attachment ? (
                         <button onClick={() => downloadAttachment(p)} className="text-indigo-600 hover:text-indigo-800" title={p.fileName}>
                           <FileText className="w-5 h-5" />
                         </button>
                       ) : (
                         <span className="text-gray-300">-</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => deletePayment(p.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-5 h-5" />
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
