
import React, { useState, useEffect } from 'react';
import { Client, TaxRate, LogActionType, LogEntityType } from '../types';
import { ATECO_ACTIVITIES } from '../constants';
import { Card } from './Card';
import { Button } from './Button';
import { CheckCircle, AlertCircle, Briefcase, Save, Loader2 } from 'lucide-react';
import { createClientStructure } from '../utils/googleDrive';

interface SettingsProps {
  client: Client;
  onUpdateClient: (client: Client) => void;
  onLog: (action: LogActionType, entity: LogEntityType, description: string, clientId?: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ client, onUpdateClient, onLog }) => {
  const [formData, setFormData] = useState<Client>(client);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);

  // Sync state if the selected client changes from the parent navigation
  useEffect(() => {
    setFormData(client);
    setHasChanges(false);
  }, [client.id]);
  
  const handleActivityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const activityId = e.target.value;
    const activity = ATECO_ACTIVITIES.find(a => a.id === activityId);
    
    if (activity) {
      setFormData(prev => ({
        ...prev,
        activityId: activity.id,
        atecoCode: activity.code,
        profitabilityCoefficient: activity.coefficient,
      }));
      setHasChanges(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'taxRate' ? Number(value) : value
    }));
    setHasChanges(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Salvataggio locale
    onUpdateClient(formData);
    onLog('UPDATE', 'SETTINGS', `Aggiornata anagrafica/impostazioni`, client.id);
    setHasChanges(false);

    // 2. Logica Google Drive Automatica
    // Verifichiamo se l'utente è autenticato su Drive controllando il token globale di gapi
    const isDriveAuth = typeof window !== 'undefined' && 
                        (window as any).gapi?.client?.getToken() !== null;
    
    if (isDriveAuth) {
      const confirmDrive = window.confirm(
        `Dati salvati localmente. Vuoi creare/aggiornare anche la struttura cartelle su Google Drive per "${formData.name}"?`
      );

      if (confirmDrive) {
        setIsCreatingFolders(true);
        try {
          await createClientStructure(formData.name);
          alert('Struttura cartelle creata con successo su Google Drive!');
        } catch (err) {
          console.error(err);
          alert('Errore nella creazione delle cartelle su Drive. Verifica la connessione e i permessi.');
        } finally {
          setIsCreatingFolders(false);
        }
      }
    } else {
      alert('Anagrafica salvata correttamente localmente. (Nota: Google Drive non connesso)');
    }
  };

  const selectedActivity = ATECO_ACTIVITIES.find(a => a.id === formData.activityId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900">Anagrafica & Configurazione</h2>
          {isCreatingFolders && (
            <div className="flex items-center text-xs text-indigo-600 animate-pulse mt-1">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Sincronizzazione Drive in corso...
            </div>
          )}
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isCreatingFolders}
          className={hasChanges ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
        >
          {isCreatingFolders ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isCreatingFolders ? 'Creazione...' : 'Salva Modifiche'}
        </Button>
      </div>
      
      <Card title="Attività Professionale (ATECO)" className="border-t-4 border-t-indigo-600">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Seleziona Attività
            </label>
            <select
              value={formData.activityId || ''}
              onChange={handleActivityChange}
              className="w-full rounded-md border-gray-300 border p-2.5 focus:ring-indigo-500 bg-white"
            >
              <option value="" disabled>-- Seleziona il tipo di attività --</option>
              {ATECO_ACTIVITIES.map(act => (
                <option key={act.id} value={act.id}>
                  {act.code} - {act.description}
                </option>
              ))}
            </select>
          </div>

          {selectedActivity ? (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Parametri Fiscali Applicati</h4>
                  <p className="text-xs text-indigo-700 mt-1">
                    In base all'attività <strong>{selectedActivity.code}</strong> sono stati impostati i seguenti parametri:
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2 pl-8">
                 <div className="bg-white p-3 rounded border border-indigo-100">
                   <p className="text-xs text-gray-500 uppercase font-semibold">Coefficiente Redditività</p>
                   <p className="text-lg font-bold text-gray-900">{(selectedActivity.coefficient * 100).toFixed(0)}%</p>
                 </div>
                 <div className="bg-white p-3 rounded border border-indigo-100">
                   <p className="text-xs text-gray-500 uppercase font-semibold">Inquadramento INPS</p>
                   <p className="text-sm font-medium text-gray-900">{selectedActivity.inpsType}</p>
                 </div>
                 <div className="col-span-2 bg-white p-3 rounded border border-indigo-100">
                   <p className="text-xs text-gray-500 uppercase font-semibold">Regime IVA</p>
                   <p className="text-sm font-medium text-gray-900">{selectedActivity.vatRegime}</p>
                 </div>
              </div>
            </div>
          ) : (
             <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
               <div>
                 <h4 className="font-bold text-yellow-800 text-sm">Nessuna attività selezionata</h4>
                 <p className="text-xs text-yellow-700 mt-1">Seleziona un'attività per calcolare correttamente il reddito imponibile.</p>
               </div>
             </div>
          )}
        </div>
      </Card>
      
      <Card title="Dati Anagrafici">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Ragione Sociale</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale / P.IVA</label>
             <input
              type="text"
              name="fiscalCode"
              value={formData.fiscalCode}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aliquota Imposta Sostitutiva</label>
            <select
              name="taxRate"
              value={formData.taxRate}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
            >
              <option value={TaxRate.STARTUP}>5% (Start-up / Primi 5 anni)</option>
              <option value={TaxRate.STANDARD}>15% (Standard)</option>
            </select>
          </div>

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato Cliente</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500"
              >
                <option value="active">Attivo</option>
                <option value="ceased">Cessato / Storico</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note Interne Studio</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 border p-2 focus:ring-indigo-500 h-24"
                placeholder="Note riservate allo studio..."
              />
            </div>
            
            <div className="text-xs text-gray-400 mt-4 text-center">
              Parametri globali (limite ricavi, ecc.) gestiti dall'amministratore.
            </div>
        </form>
      </Card>
    </div>
  );
};
