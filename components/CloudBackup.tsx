
import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Cloud, UploadCloud, DownloadCloud, CheckCircle, AlertTriangle, Loader2, Lock, Save, FolderOpen, HardDrive, FileJson } from 'lucide-react';
import { initGoogleDrive, handleAuthClick, uploadBackup, downloadBackup } from '../utils/googleDrive';

interface CloudBackupProps {
  appState: {
    clients: any;
    invoices: any;
    inpsPayments: any;
    globalConfig: any;
    logs: any;
  };
  onRestore: (data: any) => void;
}

export const CloudBackup: React.FC<CloudBackupProps> = ({ appState, onRestore }) => {
  // GOOGLE STATE
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState('');
  
  // LOCAL STATE
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // CONFIGURAZIONE GOOGLE DRIVE - AGGIORNATA CON NUOVO CLIENT ID
  const [apiConfig, setApiConfig] = useState({
    clientId: '459844148501-9fc3ns8fpd7dl7pcgmiodbnh53vd3hol.apps.googleusercontent.com',
    apiKey: 'AIzaSyA6uuUAnAv6SkL1ZXmfoxFWyAwHynhDEb4'
  });

  useEffect(() => {
    if (apiConfig.clientId && apiConfig.apiKey) {
      initGoogleDrive(apiConfig.apiKey, apiConfig.clientId, (avail) => {
        setIsApiLoaded(avail);
      });
    }
  }, [apiConfig]);

  // --- LOCAL FILE HANDLERS (ALWAYS WORK) ---

  const handleLocalDownload = () => {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: appState
      };
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_forfettario_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up
      
      alert("Backup scaricato correttamente nella tua cartella Download!");
    } catch (e) {
      console.error(e);
      alert("Errore durante la creazione del file di backup.");
    }
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Attenzione: Caricando questo file SOVRASCRIVERAI tutti i dati attuali. Vuoi procedere?")) {
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed && parsed.data) {
          onRestore(parsed.data);
          // Success message handled by parent via alert usually, or we can add one here
        } else {
          alert("Il file selezionato non è un backup valido.");
        }
      } catch (err) {
        console.error(err);
        alert("Errore nella lettura del file. Assicurati che sia un JSON valido.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- GOOGLE DRIVE HANDLERS ---

  const handleLogin = async () => {
    try {
      await handleAuthClick();
      setIsAuthenticated(true);
      setGoogleStatusMsg("Connesso a Google Drive");
    } catch (err: any) {
      console.error(err);
      if (err.error === 'popup_closed_by_user') {
        setGoogleStatusMsg("Login annullato.");
      } else {
        setGoogleStatusMsg("Errore login. Verifica le impostazioni OAuth nella Google Cloud Console.");
      }
    }
  };

  const handleDriveBackup = async () => {
    if (!isAuthenticated) return;
    setIsGoogleLoading(true);
    setGoogleStatusMsg("Caricamento...");
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: appState
      };
      
      const res = await uploadBackup(backupData);
      setGoogleStatusMsg(`Backup Drive completato!`);
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg("Errore backup Drive: " + (err.message || 'Errore sconosciuto'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!isAuthenticated) return;
    if (!window.confirm("Attenzione: Sovrascriverai i dati locali con quelli di Drive. Procedere?")) return;
    
    setIsGoogleLoading(true);
    setGoogleStatusMsg("Scaricamento...");
    try {
      const jsonStr = await downloadBackup();
      const parsed = JSON.parse(jsonStr);
      
      if (parsed && parsed.data) {
        onRestore(parsed.data);
        setGoogleStatusMsg(`Ripristino Drive OK! (${new Date(parsed.timestamp).toLocaleDateString()})`);
      } else {
        throw new Error("Formato non valido");
      }
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg("Errore ripristino: " + (err.message || "File non trovato"));
    } finally {
      setIsGoogleLoading(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Backup & Ripristino</h2>
        <p className="text-gray-500">Salva i tuoi dati per non perderli. Usa il "Backup su File" se non riesci ad accedere a Google Drive.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LOCAL BACKUP CARD */}
        <Card className="border-t-4 border-t-indigo-600 h-full flex flex-col">
           <div className="mb-6 flex items-start justify-between">
             <div>
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <HardDrive className="w-5 h-5 text-indigo-600" />
                 Backup su File (Consigliato)
               </h3>
               <p className="text-sm text-gray-500 mt-1">
                 Salva un file sul tuo computer. Funziona sempre, non richiede internet o account.
               </p>
             </div>
           </div>

           <div className="flex-1 flex flex-col justify-center space-y-4">
             <Button onClick={handleLocalDownload} size="lg" className="w-full justify-start">
               <Save className="w-5 h-5 mr-3" />
               <div className="text-left">
                 <div className="font-bold">Scarica Backup</div>
                 <div className="text-xs font-normal opacity-80">Salva .json sul PC</div>
               </div>
             </Button>

             <div className="relative">
               <input 
                 type="file" 
                 accept=".json" 
                 ref={fileInputRef}
                 onChange={handleLocalUpload}
                 className="hidden" 
               />
               <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="lg" className="w-full justify-start">
                 <FolderOpen className="w-5 h-5 mr-3" />
                 <div className="text-left">
                   <div className="font-bold">Carica Backup</div>
                   <div className="text-xs font-normal opacity-80">Ripristina da .json</div>
                 </div>
               </Button>
             </div>
           </div>
           
           <div className="mt-6 p-3 bg-indigo-50 text-indigo-800 text-xs rounded border border-indigo-100 flex gap-2">
             <FileJson className="w-4 h-4 flex-shrink-0" />
             Il file scaricato contiene tutti i clienti, fatture e impostazioni. Conservalo al sicuro.
           </div>
        </Card>


        {/* GOOGLE DRIVE CARD */}
        <Card className="border-t-4 border-t-green-600 h-full flex flex-col opacity-90">
           <div className="mb-6">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
               <Cloud className="w-5 h-5 text-green-600" />
               Google Drive (Cloud)
             </h3>
             <p className="text-sm text-gray-500 mt-1">
               Sincronizza direttamente col tuo account Google.
             </p>
             {isAuthenticated && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                  <CheckCircle className="w-3 h-3 mr-1" /> Connesso
                </span>
             )}
           </div>

           <div className="flex-1 flex flex-col justify-center space-y-4">
             {!isApiLoaded ? (
                <div className="text-center text-sm text-gray-400 py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Caricamento API Google...
                </div>
             ) : !isAuthenticated ? (
                <div className="space-y-3">
                  <Button onClick={handleLogin} variant="secondary" className="w-full">
                    <Lock className="w-4 h-4 mr-2" />
                    Connetti Account Google
                  </Button>
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Se riscontri errori di autorizzazione, assicurati che il Client ID sia configurato correttamente nella Google Cloud Console.
                  </div>
                </div>
             ) : (
               <>
                 <Button onClick={handleDriveBackup} disabled={isGoogleLoading} className="w-full justify-start bg-green-600 hover:bg-green-700">
                   {isGoogleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2" />}
                   <div className="text-left">
                     <div className="font-bold">Upload su Drive</div>
                     <div className="text-xs font-normal opacity-80">Sovrascrive il cloud</div>
                   </div>
                 </Button>
                 
                 <Button onClick={handleDriveRestore} disabled={isGoogleLoading} variant="secondary" className="w-full justify-start">
                   {isGoogleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <DownloadCloud className="w-4 h-4 mr-2" />}
                   <div className="text-left">
                     <div className="font-bold">Download da Drive</div>
                     <div className="text-xs font-normal opacity-80">Sovrascrive dati locali</div>
                   </div>
                 </Button>
               </>
             )}
             
             {googleStatusMsg && (
               <div className={`text-xs text-center font-medium p-2 rounded ${googleStatusMsg.toLowerCase().includes('errore') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                 {googleStatusMsg}
               </div>
             )}
           </div>
        </Card>

      </div>
    </div>
  );
};
