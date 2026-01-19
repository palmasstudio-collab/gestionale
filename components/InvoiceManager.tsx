
import React, { useState, useEffect, useRef } from 'react';
import { Invoice, PaymentStatus, Client, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, X, DollarSign, CloudSync, RefreshCw, AlertCircle, Paperclip, FileCheck, Loader2, Lock, Edit2, Trash2, Save } from 'lucide-react';
import { syncInvoiceToSpreadsheet, handleAuthClick, findSubfolderId, uploadFileToDrive } from '../utils/googleDrive';

interface InvoiceManagerProps {
  client: Client;
  allInvoices: Invoice[];
  setAllInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ client, allInvoices, setAllInvoices, onLog }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const activityConfig = ATECO_ACTIVITIES.find(a => a.id === client.activityId);
  const isGoogleAuthenticated = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;

  const [formData, setFormData] = useState<Partial<Invoice>>({
    status: PaymentStatus.PAID,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    taxableAmount: 0,
    cassaAmount: 0,
    amount: 0,
  });

  // Ricalcolo automatico cassa e totale
  useEffect(() => {
    if (activityConfig && formData.taxableAmount !== undefined) {
      const calculatedCassa = activityConfig.hasCassa && activityConfig.cassaRate ? formData.taxableAmount * activityConfig.cassaRate : 0;
      setFormData(prev => ({ 
        ...prev, 
        cassaAmount: calculatedCassa, 
        amount: (prev.taxableAmount || 0) + calculatedCassa 
      }));
    }
  }, [formData.taxableAmount, activityConfig]);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setSelectedFile(null);
    setFormData({
      status: PaymentStatus.PAID,
      date: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      taxableAmount: 0,
      cassaAmount: 0,
      amount: 0,
      number: '',
      clientName: ''
    });
  };

  const handleStartEdit = (invoice: Invoice) => {
    setFormData({ ...invoice });
    setEditingId(invoice.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string, number: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare la fattura n. ${number}?`)) {
      setAllInvoices(prev => prev.filter(inv => inv.id !== id));
      onLog('DELETE', 'INVOICE', `Eliminata fattura n. ${number}`, client.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number || !formData.clientName || !formData.date) return;

    setIsSyncing(true);
    let driveFileId: string | undefined = formData.driveFileId;

    try {
      // 1. Gestione File PDF (Solo se nuovo file selezionato)
      if (selectedFile && client.rootFolderId) {
        if (!isGoogleAuthenticated) await handleAuthClick();
        setUploadingFile(true);
        const folderId = await findSubfolderId(client.rootFolderId, '01_Fatture_Emesse');
        if (folderId) {
          driveFileId = await uploadFileToDrive(selectedFile, folderId);
        }
      }

      const invoice: Invoice = {
        id: editingId || Date.now().toString(),
        clientId: client.id,
        number: formData.number,
        clientName: formData.clientName,
        date: formData.date,
        status: formData.status as PaymentStatus,
        paymentDate: formData.status === PaymentStatus.PAID ? (formData.paymentDate || formData.date) : undefined,
        taxableAmount: Number(formData.taxableAmount),
        cassaAmount: Number(formData.cassaAmount),
        amount: Number(formData.amount),
        fileName: selectedFile ? selectedFile.name : formData.fileName,
        driveFileId
      };

      if (editingId) {
        setAllInvoices(prev => prev.map(inv => inv.id === editingId ? invoice : inv));
        onLog('UPDATE', 'INVOICE', `Modificata fattura n. ${invoice.number}`, client.id);
      } else {
        setAllInvoices(prev => [...prev, invoice]);
        onLog('CREATE', 'INVOICE', `Creata fattura n. ${invoice.number}`, client.id);
        
        // Sincronizzazione Sheets solo per nuove fatture (per evitare duplicati nello sheet se non gestito update)
        if (client.spreadsheetId && isGoogleAuthenticated) {
          await syncInvoiceToSpreadsheet(client.spreadsheetId, invoice);
        }
      }

      resetForm();
    } catch (err) {
      console.error("Errore salvataggio:", err);
      alert("Errore durante il salvataggio.");
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
        <Button onClick={() => { if(isFormOpen) resetForm(); else setIsFormOpen(true); }}>
          {isFormOpen ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {isFormOpen ? 'Annulla' : 'Nuova Fattura'}
        </Button>
      </div>

      {/* Avvisi Cloud */}
      {!isGoogleAuthenticated ? (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between text-amber-800">
           <div className="flex items-center gap-3">
             <Lock className="w-5 h-5 text-amber-600" />
             <p className="text-sm">Accesso Google non attivo. Le funzioni Cloud sono disabilitate.</p>
           </div>
           <Button onClick={() => handleAuthClick()} size="sm" variant="secondary">Accedi</Button>
        </div>
      ) : !client.rootFolderId && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3 text-blue-800 font-medium">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           <p className="text-sm">Configurazione cartelle mancante. Vai in <strong>Anagrafica</strong> e salva per attivare l'archivio.</p>
        </div>
      )}

      {isFormOpen && (
        <Card title={editingId ? `Modifica Fattura n. ${formData.number}` : "Nuova Fattura"} className="mb-6 animate-fade-in border-t-4 border-t-indigo-500">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
                <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="es. 10/2024" value={formData.number || ''} onChange={e => setFormData({...formData, number: e.target.value})} />
              </div>
              <div className="md:col-span-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente Finale</label>
                <input type="text" required className="w-full rounded-md border-gray-300 border p-2" placeholder="Nome Cliente" value={formData.clientName || ''} onChange={e => setFormData({...formData, clientName: e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" required className="w-full rounded-md border-gray-300 border p-2" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Compenso (€)</label>
                  <input type="number" required step="0.01" className="w-full rounded-md border-gray-300 border p-2 text-lg" value={formData.taxableAmount || ''} onChange={e => setFormData({...formData, taxableAmount: Number(e.target.value)})} />
               </div>
               <div className="flex flex-col justify-end">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{activityConfig?.cassaLabel || 'Cassa'}</label>
                  <div className="w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-lg text-gray-600">€ {formData.cassaAmount?.toFixed(2) || '0.00'}</div>
               </div>
               <div className="flex flex-col justify-end">
                  <label className="block text-sm font-bold text-indigo-700 mb-1">Totale Documento (€)</label>
                  <div className="w-full rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xl font-bold text-indigo-700">€ {formData.amount?.toFixed(2) || '0.00'}</div>
               </div>
            </div>

            <div className="border-t pt-4 flex flex-col md:flex-row items-center gap-4">
               <div className="flex-1 w-full">
                 <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                   <Paperclip className="w-4 h-4" /> {formData.driveFileId ? 'Aggiorna PDF Fattura' : 'Allega Fattura PDF'}
                 </label>
                 <input type="file" accept="application/pdf" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
                 <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={!client.rootFolderId || !isGoogleAuthenticated}>
                       {selectedFile ? 'Cambia PDF' : (formData.driveFileId ? 'Sostituisci PDF' : 'Seleziona PDF')}
                    </Button>
                    {(selectedFile || formData.driveFileId) && (
                      <span className="text-sm font-medium text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                        <FileCheck className="w-4 h-4" /> {selectedFile ? selectedFile.name : (formData.fileName || 'Documento archiviato')}
                      </span>
                    )}
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button type="button" variant="ghost" onClick={resetForm}>Annulla</Button>
                 <Button type="submit" disabled={isSyncing}>
                   {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editingId ? <Save className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />)}
                   {editingId ? 'Salva Modifiche' : 'Salva & Archivia'}
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
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cloud</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientInvoices.length === 0 ? (
                 <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nessuna fattura presente.</td></tr>
              ) : (
                clientInvoices.map((inv) => (
                  <tr key={inv.id} className={`hover:bg-gray-50 ${editingId === inv.id ? 'bg-indigo-50' : ''}`}>
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
                         <FileCheck className="w-5 h-5 text-green-600 mx-auto" />
                       ) : (
                         <span className="text-gray-300">-</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                       <div className="flex justify-end gap-2">
                          <button onClick={() => handleStartEdit(inv)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Modifica">
                             <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(inv.id, inv.number)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Elimina">
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
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
