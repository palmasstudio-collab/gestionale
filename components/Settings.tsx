
import React, { useState, useEffect } from 'react';
import { Client, TaxRate, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Save, Loader2, Database, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { createClientStructure, handleAuthClick } from '../utils/googleDrive';

interface SettingsProps {
  client: Client;
  onUpdateClient: (client: Client) => void;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
  isDriveReady: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ client, onUpdateClient, onLog, isDriveReady }) => {
  const [formData, setFormData] = useState<Client>(client);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData(client);
    setHasChanges(false);
    setErrorMsg(null);
  }, [client.id, client.spreadsheetId]);
  
  const handleActivityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const activityId = e.target.value;
    const activity = ATECO_ACTIVITIES.find(a => a.id === activityId);
    if (activity) {
      setFormData(prev => ({ ...prev, activityId: activity.id, atecoCode: activity.code, profitabilityCoefficient: activity.coefficient }));
      setHasChanges(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'taxRate' ? Number(value) : value }));
    setHasChanges(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateClient(formData);
    onLog('UPDATE', 'SETTINGS', `Aggiornata anagrafica`, client.id);
    setHasChanges(false);
    setErrorMsg(null);

    const isDriveAuth = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;
    
    if (confirm(`Dati salvati localmente.\n\nVuoi attivare ora la sincronizzazione Google Drive e creare il Database Excel per questo cliente?`)) {
      if (!isDriveReady) {
        alert("Sincronizzazione API in corso... Attendi 2 secondi.");
        return;
      }

      setIsCreatingFolders(true);
      try {
        // Forza sempre il check di autorizzazione se proviamo a creare la struttura
        await handleAuthClick();
        
        const result = await createClientStructure(formData.name);
        
        const updatedClient = { ...formData, spreadsheetId: result.spreadsheetId };
        onUpdateClient(updatedClient);
        setFormData(updatedClient);
        
        alert('Configurazione Cloud completata con successo!');
      } catch (err: any) {
        console.error("Errore critico Cloud:", err);
        const msg = err.message || "Impossibile contattare i server Google.";
        setErrorMsg(msg);
      } finally {
        setIsCreatingFolders(false);
      }
    }
  };

  const selectedActivity = ATECO_ACTIVITIES.find(a => a.id === formData.activityId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Anagrafica & Configurazione</h2>
        <Button onClick={handleSave} disabled={!hasChanges || isCreatingFolders}>
          {isCreatingFolders ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salva Modifiche
        </Button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg flex gap-4 text-red-800 animate-fade-in shadow-sm">
           <AlertCircle className="w-6 h-6 flex-shrink-0" />
           <div className="space-y-3">
             <p className="font-bold text-lg">Errore di Sincronizzazione Cloud</p>
             <p className="text-sm bg-white/50 p-2 rounded border border-red-200 font-mono">{errorMsg}</p>
             
             <div className="text-sm space-y-2">
               <p className="font-semibold">Possibili soluzioni:</p>
               <ul className="list-disc list-inside space-y-1 opacity-90">
                 <li>Abilita le <strong>Google Sheets API</strong> nella Console di Google.</li>
                 <li>Assicurati di spuntare la casella <strong>"Visualizza, modifica, crea... fogli di calcolo"</strong> nel popup di Google.</li>
                 <li>Riprova a cliccare su Salva per rigenerare il token.</li>
               </ul>
             </div>
             
             <a 
               href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" 
               target="_blank" 
               className="inline-flex items-center text-xs font-bold text-red-600 hover:underline bg-white px-3 py-1.5 rounded-md border border-red-200"
             >
               <ExternalLink className="w-3 h-3 mr-1" /> Vai alla Console Google per abilitare Sheets
             </a>
           </div>
        </div>
      )}
      
      <Card title="Attività Professionale (ATECO)" className="border-t-4 border-t-indigo-600">
        <div className="space-y-6">
          <select value={formData.activityId || ''} onChange={handleActivityChange} className="w-full rounded-md border-gray-300 border p-2.5 focus:ring-indigo-500 bg-white">
            <option value="" disabled>-- Seleziona attività --</option>
            {ATECO_ACTIVITIES.map(act => <option key={act.id} value={act.id}>{act.code} - {act.description}</option>)}
          </select>
          {selectedActivity && (
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
               <span className="text-sm font-medium">Coefficiente Redditività: <strong>{(selectedActivity.coefficient * 100).toFixed(0)}%</strong></span>
               <span className="text-sm font-medium">Inquadramento: <strong>{selectedActivity.inpsType}</strong></span>
            </div>
          )}
        </div>
      </Card>
      
      <Card title="Dati Anagrafici">
        <form onSubmit={handleSave} className="space-y-4">
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ragione Sociale" className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" />
          <input type="text" name="fiscalCode" value={formData.fiscalCode} onChange={handleChange} placeholder="Codice Fiscale / P.IVA" className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Aliquota Imposta</label>
              <select name="taxRate" value={formData.taxRate} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2">
                <option value={TaxRate.STARTUP}>5% (Primi 5 anni)</option>
                <option value={TaxRate.STANDARD}>15% (Standard)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Infrastruttura Cloud Studio</label>
              <div className={`p-2 rounded border flex items-center gap-2 ${formData.spreadsheetId ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                <Database className="w-4 h-4" />
                <span className="text-xs font-bold truncate">
                  {formData.spreadsheetId ? 'Database Excel Attivo' : 'Cloud non inizializzato'}
                </span>
                {formData.spreadsheetId ? <CheckCircle className="w-3 h-3 ml-auto text-green-500" /> : <XCircle className="w-3 h-3 ml-auto text-gray-300" />}
              </div>
            </div>
          </div>

          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2 h-24" placeholder="Note interne per lo studio..." />
        </form>
      </Card>
    </div>
  );
};
