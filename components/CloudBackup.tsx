
import React, { useState, useRef } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Cloud, UploadCloud, DownloadCloud, CheckCircle, Loader2, Lock, Save, FolderOpen, HardDrive } from 'lucide-react';
import { handleAuthClick, uploadBackup, downloadBackup } from '../utils/googleDrive';

interface CloudBackupProps {
  appState: {
    clients: any;
    invoices: any;
    inpsPayments: any;
    globalConfig: any;
    logs: any;
  };
  onRestore: (data: any) => void;
  isDriveReady: boolean;
}

export const CloudBackup: React.FC<CloudBackupProps> = ({ appState, onRestore, isDriveReady }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      link.download = `backup_palmas_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert("Backup scaricato correttamente!");
    } catch (e) {
      console.error(e);
      alert("Errore durante la creazione del file.");
    }
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Attenzione: Sovrascriverai TUTTI i dati attuali dello studio. Procedere?")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && parsed.data) {
          onRestore(parsed.data);
        } else {
          alert("Backup non valido.");
        }
      } catch (err) {
        alert("Errore caricamento file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogin = async () => {
    try {
      await handleAuthClick();
      setIsAuthenticated(true);
      setGoogleStatusMsg("Connesso a Google Drive - Studio Palmas");
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg("Errore autorizzazione. Verifica popup browser.");
    }
  };

  const handleDriveBackup = async () => {
    if (!isAuthenticated) return;
    setIsGoogleLoading(true);
    setGoogleStatusMsg("Salvataggio in corso...");
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: appState
      };
      await uploadBackup(backupData);
      setGoogleStatusMsg(`Backup Cloud completato!`);
    } catch (err: any) {
      setGoogleStatusMsg("Errore salvataggio Cloud.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!isAuthenticated) return;
    if (!window.confirm("Attenzione: Ripristinando da Drive perderai le modifiche locali non salvate. Procedere?")) return;
    
    setIsGoogleLoading(true);
    setGoogleStatusMsg("Sincronizzazione...");
    try {
      const jsonStr = await downloadBackup();
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.data) {
        onRestore(parsed.data);
        setGoogleStatusMsg(`Sincronizzazione Drive OK!`);
      }
    } catch (err: any) {
      setGoogleStatusMsg("Errore ripristino dal Cloud.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Backup & Sincronizzazione</h2>
        <p className="text-gray-500">Gestisci la sicurezza dei dati dello Studio Palmas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-t-4 border-t-indigo-600 h-full flex flex-col">
           <div className="mb-6">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <HardDrive className="w-5 h-5 text-indigo-600" /> Backup su File
               </h3>
               <p className="text-sm text-gray-500 mt-1">Salva un file .json fisico per sicurezza offline.</p>
           </div>
           <div className="flex-1 space-y-4">
             <Button onClick={handleLocalDownload} size="lg" className="w-full justify-start">
               <Save className="w-5 h-5 mr-3" /> Scarica Backup Locale
             </Button>
             <div className="relative">
               <input type="file" accept=".json" ref={fileInputRef} onChange={handleLocalUpload} className="hidden" />
               <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="lg" className="w-full justify-start">
                 <FolderOpen className="w-5 h-5 mr-3" /> Carica Backup Locale
               </Button>
             </div>
           </div>
        </Card>

        <Card className="border-t-4 border-t-green-600 h-full flex flex-col">
           <div className="mb-6">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
               <Cloud className="w-5 h-5 text-green-600" /> Google Cloud Sincro
             </h3>
             <p className="text-sm text-gray-500 mt-1">Sincronizzazione account Studio Palmas.</p>
             {isAuthenticated && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                  <CheckCircle className="w-3 h-3 mr-1" /> Connesso
                </span>
             )}
           </div>

           <div className="flex-1 space-y-4">
             {!isDriveReady ? (
                <div className="text-center text-sm text-gray-400 py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> 
                  Connessione ai servizi Google...
                </div>
             ) : !isAuthenticated ? (
                <Button onClick={handleLogin} variant="secondary" className="w-full">
                  <Lock className="w-4 h-4 mr-2" /> Effettua Login Studio
                </Button>
             ) : (
               <>
                 <Button onClick={handleDriveBackup} disabled={isGoogleLoading} className="w-full justify-start bg-green-600 hover:bg-green-700 text-white">
                   {isGoogleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2" />} Salva su Cloud
                 </Button>
                 <Button onClick={handleDriveRestore} disabled={isGoogleLoading} variant="secondary" className="w-full justify-start">
                   {isGoogleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <DownloadCloud className="w-4 h-4 mr-2" />} Sincronizza da Cloud
                 </Button>
               </>
             )}
             {googleStatusMsg && (
               <div className={`text-xs text-center font-medium p-2 rounded mt-2 ${googleStatusMsg.includes('Errore') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                 {googleStatusMsg}
               </div>
             )}
           </div>
        </Card>
      </div>
    </div>
  );
};
