
import React, { useState, useEffect, useRef } from 'react';
import { Invoice, PaymentStatus, Client, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, X, DollarSign, CloudSync, RefreshCw, AlertCircle, Paperclip, FileCheck, Loader2, Lock } from 'lucide-react';
import { syncInvoiceToSpreadsheet, handleAuthClick, findSubfolderId, uploadFileToDrive } from '../utils/googleDrive';

interface InvoiceManagerProps {
  client: Client;
  allInvoices: Invoice[];
  setAllInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ client, allInvoices, setAllInvoices, onLog }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const activityConfig = ATECO_ACTIVITIES.find(a => a.id === client.activityId);

  // Determina se Google è autenticato guardando il token globale della libreria
  const isGoogleAuthenticated = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    status: PaymentStatus.PAID,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    taxableAmount: 0,
    cassaAmount: 0,
    amount: 0,
  });

  useEffect(() => {
    if (activityConfig && newInvoice.taxableAmount !== undefined) {
      let calculatedCassa = activityConfig.hasCassa && activityConfig.cassaRate ? newInvoice.taxableAmount * activityConfig.cassaRate : 0;
      setNewInvoice(prev => ({ ...prev, cassaAmount: calculatedCassa, amount: (prev.taxableAmount || 0) + calculatedCassa }));
    }
  }, [newInvoice.taxableAmount, activityConfig]);

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.number || !newInvoice.clientName || !newInvoice.date) return;

    setIsSyncing(true);
    let driveFileId: string | undefined = undefined;

    try {
      if (!isGoogleAuthenticated) {
        await handleAuthClick();
      }

      // 1. Caricamento File PDF se presente
      if (selectedFile && client.rootFolderId) {
        setUploadingFile(true);
        const folderId = await findSubfolderId(client.rootFolderId, '01_Fatture_Emesse');
        if (folderId) {
          driveFileId = await uploadFileToDrive(selectedFile, folderId);
        }
      }

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
        fileName: selectedFile?.name,
        driveFileId
      };

      setAllInvoices(prev => [...prev, invoice]);
      onLog('CREATE', 'INVOICE', `Creata fattura n. ${invoice.number} ${driveFileId ? '(con PDF)' : ''}`, client.id);

      // 2. Sincronizzazione Sheets
      if (client.spreadsheetId) {
        await syncInvoiceToSpreadsheet(client.spreadsheetId, invoice);
      }

      setIsAdding(false);
      setSelectedFile(null);
      setNewInvoice({
        status: PaymentStatus.PAID, date: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0], number: '', clientName: '',
        taxableAmount: 0, cassaAmount: 0, amount: 0
      });
    } catch (err) {
      console.error("Errore salvataggio fattura:", err);
      alert("Errore durante il salvataggio o l'upload del PDF.");
    } finally {
      setIsSyncing(false);
      setUploadingFile(false);
    }
  };

  const clientInvoices = allInvoices.filter(inv => inv.clientId === client.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900">Gestione Fatture</h2>
           <p className="text-sm text-gray-500">Configurazione: {activityConfig?.code || 'N.D.'}</p>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      {/* Avvisi Cloud Intelligenti */}
      {!isGoogleAuthenticated ? (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between text-amber-800">
           <div className="flex items-center gap-3">
             <Lock className="w-5 h-5 text-amber-600" />
             <p className="text-sm">L'accesso al Cloud non è attivo. Le fatture non verranno archiviate su Drive.</p>
           </div>
           <Button onClick={() => handleAuthClick()} size="sm" variant="secondary">Accedi</Button>
        </div>
      ) : !client.rootFolderId ? (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3 text-blue-800 font-medium">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           <p className="text-sm">Sei connesso al Cloud, ma le cartelle per questo cliente non sono state create. Vai in <strong>Anagrafica</strong> e clicca su <strong>Salva Modifiche</strong>.</p>
        </div>
      ) : null}

      {isAdding && (
        <Card title="Nuova Fattura" className="mb-6 animate-fade-in border-t-4 border-t-indigo-500">
          <form onSubmit={handleAddInvoice} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
                <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="es. 10/2024" value={newInvoice.number || ''} onChange={e => setNewInvoice({...newInvoice, number: e.target.value})} />
              </div>
              <div className="md:col-span-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente Finale</label>
                <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="Nome Cliente" value={newInvoice.clientName || ''} onChange={e => setNewInvoice({...newInvoice, clientName: e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" required className="w-full rounded-md border-gray-300 border p-2" value={newInvoice.date || ''} onChange={e => setNewInvoice({...newInvoice, date: e.target.value})} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="border-t pt-4 flex flex-col md:flex-row items-center gap-4">
               <div className="flex-1 w-full">
                 <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                   <Paperclip className="w-4 h-4" /> Allega Fattura PDF (Cloud)
                 </label>
                 <input 
                   type="file" 
                   accept="application/pdf" 
                   ref={fileInputRef} 
                   onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                   className="hidden" 
                 />
                 <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={!client.rootFolderId || !isGoogleAuthenticated}>
                       {selectedFile ? 'Cambia PDF' : 'Seleziona PDF'}
                    </Button>
                    {selectedFile && (
                      <span className="text-sm font-medium text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                        <FileCheck className="w-4 h-4" /> {selectedFile.name}
                      </span>
                    )}
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>Annulla</Button>
                 <Button type="submit" disabled={isSyncing}>
                   {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                   Salva & Archivia
                 </Button>
               </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fattura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">Totale</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Doc. Cloud</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientInvoices.length === 0 ? (
                 <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nessuna fattura presente.</td></tr>
              ) : (
                clientInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === PaymentStatus.PAID ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{inv.number}</div>
                      <div className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString('it-IT')}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{inv.clientName}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">€ {inv.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                       {inv.driveFileId ? (
                         <div className="text-green-600 flex items-center justify-center gap-1" title="File archiviato su Drive">
                           <FileCheck className="w-5 h-5" />
                           <span className="text-[10px] font-bold">PDF</span>
                         </div>
                       ) : (
                         <span className="text-gray-300">-</span>
                       )}
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
