
import React, { useState, useRef } from 'react';
import { InpsPayment, LogActionType, LogEntityType, Client } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Trash2, Landmark, Paperclip, FileText, X, FileCheck, Loader2 } from 'lucide-react';
import { handleAuthClick, findSubfolderId, uploadFileToDrive } from '../utils/googleDrive';

interface InpsManagerProps {
  clientId: string;
  payments: InpsPayment[];
  setPayments: React.Dispatch<React.SetStateAction<InpsPayment[]>>;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
  client?: Client; // Passiamo il client per avere rootFolderId
}

export const InpsManager: React.FC<InpsManagerProps> = ({ clientId, payments, setPayments, onLog, client }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [newPayment, setNewPayment] = useState<Partial<InpsPayment>>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    fileName: undefined,
    attachment: undefined
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientPayments = payments.filter(p => p.clientId === clientId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const currentYear = new Date().getFullYear();
  const totalPaidCurrentYear = clientPayments
    .filter(p => new Date(p.date).getFullYear() === currentYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.date || !newPayment.amount) return;

    setIsSaving(true);
    let driveFileId: string | undefined = undefined;

    try {
      // 1. Upload Cloud Ricevuta
      if (selectedFile && client?.rootFolderId) {
        const isDriveAuth = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;
        if (!isDriveAuth) await handleAuthClick();

        const folderId = await findSubfolderId(client.rootFolderId, '03_F24_Tasse_INPS');
        if (folderId) {
          driveFileId = await uploadFileToDrive(selectedFile, folderId);
        }
      }

      const payment: InpsPayment = {
        id: Date.now().toString(),
        clientId,
        date: newPayment.date,
        amount: Number(newPayment.amount),
        description: newPayment.description || 'Versamento INPS',
        fileName: selectedFile?.name,
        driveFileId
      };

      setPayments(prev => [...prev, payment]);
      onLog('CREATE', 'PAYMENT', `Registrato versamento € ${payment.amount} ${driveFileId ? '(Ricevuta Cloud)' : ''}`, clientId);
      
      // Reset
      setNewPayment({ date: new Date().toISOString().split('T')[0], amount: 0, description: '' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert("Errore caricamento ricevuta su Drive.");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePayment = (id: string) => {
    if (window.confirm('Eliminare questo pagamento?')) {
      const p = payments.find(x => x.id === id);
      setPayments(prev => prev.filter(p => p.id !== id));
      onLog('DELETE', 'PAYMENT', `Eliminato versamento € ${p?.amount}`, clientId);
    }
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
              <input type="date" required className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importo (€)</label>
              <input type="number" step="0.01" required className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" value={newPayment.amount || ''} onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <input type="text" className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" placeholder="es. Saldo 2023, Acconto..." value={newPayment.description} onChange={e => setNewPayment({...newPayment, description: e.target.value})} />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex-1">
               <label className="block text-sm font-medium text-gray-700 mb-1">Ricevuta Cloud (PDF F24)</label>
               <div className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} accept=".pdf,image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
                 <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} size="sm" disabled={!client?.rootFolderId}>
                   <Paperclip className="w-4 h-4 mr-2" />
                   {selectedFile ? 'Cambia File' : 'Carica PDF Ricevuta'}
                 </Button>
                 {selectedFile && (
                   <span className="text-sm text-indigo-600 flex items-center bg-indigo-50 px-2 py-1 rounded">
                     {selectedFile.name}
                     <button type="button" className="ml-2 text-gray-400 hover:text-red-500" onClick={() => setSelectedFile(null)}><X className="w-3 h-3" /></button>
                   </span>
                 )}
               </div>
             </div>
             <div className="flex items-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
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
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Doc. Cloud</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientPayments.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nessun versamento registrato.</td></tr>
              ) : (
                clientPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(p.date).toLocaleDateString('it-IT')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">€ {p.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                       {p.driveFileId ? (
                         <div className="text-green-600 flex items-center justify-center gap-1">
                           <FileCheck className="w-5 h-5" />
                           <span className="text-[10px] font-bold">PDF</span>
                         </div>
                       ) : (
                         <span className="text-gray-300">-</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => deletePayment(p.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-5 h-5" /></button>
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
