
import React, { useState, useEffect } from 'react';
import { Client, TaxRate, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { Save, Loader2, Database } from 'lucide-react';
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

  useEffect(() => {
    setFormData(client);
    setHasChanges(false);
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

    const isDriveAuth = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;
    
    if (confirm(`Dati salvati in locale.\n\nVuoi creare/aggiornare la struttura cartelle e il DATABASE EXCEL su Google Drive per questo cliente?`)) {
      if (!isDriveReady) {
        alert("Sincronizzazione Google in corso... Attendi un istante.");
        return;
      }

      setIsCreatingFolders(true);
      try {
        if (!isDriveAuth) {
          await handleAuthClick();
        }
        
        const result = await createClientStructure(formData.name);
        
        // Aggiorniamo il cliente locale con l'ID del foglio creato
        const updatedClient = { ...formData, spreadsheetId: result.spreadsheetId };
        onUpdateClient(updatedClient);
        setFormData(updatedClient);
        
        alert('Struttura cartelle e Database Excel creati con successo!');
      } catch (err: any) {
        if (err.error !== 'access_denied') {
          alert('Errore: ' + (err.message || 'Impossibile completare l\'operazione su Google Drive.'));
        }
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
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ragione Sociale" className="w-full rounded-md border-gray-300 border p-2" />
          <input type="text" name="fiscalCode" value={formData.fiscalCode} onChange={handleChange} placeholder="Codice Fiscale / P.IVA" className="w-full rounded-md border-gray-300 border p-2" />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Aliquota Imposta</label>
              <select name="taxRate" value={formData.taxRate} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2">
                <option value={TaxRate.STARTUP}>5% (Primi 5 anni)</option>
                <option value={TaxRate.STANDARD}>15% (Standard)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Database Cloud</label>
              <div className={`p-2 rounded border flex items-center gap-2 ${formData.spreadsheetId ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <Database className="w-4 h-4" />
                <span className="text-xs truncate">{formData.spreadsheetId ? 'Sincronizzato' : 'Non creato'}</span>
              </div>
            </div>
          </div>

          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2 h-24" placeholder="Note interne..." />
        </form>
      </Card>
    </div>
  );
};
