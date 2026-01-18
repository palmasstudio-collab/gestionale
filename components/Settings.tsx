
import React, { useState, useEffect } from 'react';
import { Client, TaxRate, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { CheckCircle, AlertCircle, Briefcase, Save, Loader2 } from 'lucide-react';
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
  }, [client.id]);
  
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

    // Controlla se abbiamo il permesso di scrivere su Drive
    const isDriveAuth = typeof window !== 'undefined' && (window as any).gapi?.client?.getToken() !== null;
    
    if (confirm(`Dati salvati in locale.\n\nVuoi creare la struttura cartelle su Google Drive Studio Palmas per questo cliente?`)) {
      if (!isDriveReady) {
        alert("Google Drive non è ancora pronto. Riprova tra qualche istante.");
        return;
      }

      setIsCreatingFolders(true);
      try {
        // Se non autenticato, chiedi il login al volo
        if (!isDriveAuth) {
          await handleAuthClick();
        }
        
        await createClientStructure(formData.name);
        alert('Struttura cartelle creata con successo in Google Drive!');
      } catch (err: any) {
        console.error(err);
        alert('Errore Drive: ' + (err.message || 'Impossibile creare le cartelle. Verificare la connessione.'));
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
          <select name="taxRate" value={formData.taxRate} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2">
            <option value={TaxRate.STARTUP}>5% (Primi 5 anni)</option>
            <option value={TaxRate.STANDARD}>15% (Standard)</option>
          </select>
          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full rounded-md border-gray-300 border p-2 h-24" placeholder="Note interne..." />
        </form>
      </Card>
    </div>
  );
};
