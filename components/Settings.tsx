
import React, { useState, useEffect } from 'react';
import { Client, TaxRate, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Save, Loader2, Database, CheckCircle, XCircle, AlertCircle, ExternalLink, FolderOpen, Lock } from 'lucide-react';
import { createClientStructure } from '../utils/googleDrive';

interface SettingsProps {
  client: Client;
  onUpdateClient: (client: Client) => void;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
  isDriveReady: boolean;
  isAuthenticated: boolean;
  onLogin: () => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({ client, onUpdateClient, onLog, isDriveReady, isAuthenticated, onLogin }) => {
  const [formData, setFormData] = useState<Client>(client);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData(client);
    setHasChanges(false);
    setErrorMsg(null);
  }, [client.id, client.spreadsheetId, client.rootFolderId]);
  
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
    
    if (confirm(`Vuoi sincronizzare le cartelle e il Database Cloud per questo cliente?`)) {
      if (!isDriveReady) {
        alert("Servizi Google non ancora pronti.");
        return;
      }

      setIsCreatingFolders(true);
      try {
        if (!isAuthenticated) await onLogin();
        
        const result = await createClientStructure(formData.name);
        
        const updatedClient = { 
          ...formData, 
          spreadsheetId: result.spreadsheetId,
          rootFolderId: result.rootFolderId 
        };
        onUpdateClient(updatedClient);
        setFormData(updatedClient);
        
        alert('Configurazione Cloud completata!');
      } catch (err: any) {
        setErrorMsg(err.message || "Errore durante la sincronizzazione cloud.");
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

      {!isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between text-amber-800">
           <div className="flex items-center gap-3">
             <Lock className="w-5 h-5 text-amber-600" />
             <p className="text-sm font-medium">L'accesso Google non è attivo. Effettua il login per abilitare le funzioni Cloud.</p>
           </div>
           <Button onClick={onLogin} size="sm" variant="secondary">Login Studio</Button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg flex gap-4 text-red-800 animate-fade-in shadow-sm">
           <AlertCircle className="w-6 h-6 flex-shrink-0" />
           <div className="space-y-3 text-sm">
             <p className="font-bold">Errore di Sincronizzazione Cloud</p>
             <p className="font-mono">{errorMsg}</p>
             <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" className="inline-flex items-center text-xs font-bold text-red-600 hover:underline">
               <ExternalLink className="w-3 h-3 mr-1" /> Verifica API Sheets
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
      
      <Card title="Dati Anagrafici & Stato Cloud">
        <form onSubmit={handleSave} className="space-y-4">
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ragione Sociale" className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" />
          <input type="text" name="fiscalCode" value={formData.fiscalCode} onChange={handleChange} placeholder="Codice Fiscale / P.IVA" className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${formData.spreadsheetId ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <Database className="w-5 h-5" />
              <div className="flex-1">
                <p className="text-[10px] uppercase font-bold opacity-60">Database Excel</p>
                <p className="text-xs font-bold">{formData.spreadsheetId ? 'Sincronizzato' : 'Non Inizializzato'}</p>
              </div>
              {formData.spreadsheetId && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${formData.rootFolderId ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <FolderOpen className="w-5 h-5" />
              <div className="flex-1">
                <p className="text-[10px] uppercase font-bold opacity-60">Archivio Documentale</p>
                <p className="text-xs font-bold">{formData.rootFolderId ? 'Cartelle Cloud Attive' : 'Non Inizializzato'}</p>
              </div>
              {formData.rootFolderId && <CheckCircle className="w-4 h-4 text-indigo-500" />}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};
