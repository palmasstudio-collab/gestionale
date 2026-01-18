
// Utility per l'integrazione con Google Drive API v3 - Studio Palmas

const CLIENT_ID = "459844148501-9fc3ns8fpd7dl7pcgmiodbnh53vd3hol.apps.googleusercontent.com"; 
const MASTER_FOLDER_ID = "1ogkOOPaH3EwYUV-DO-GHgZ0HswocM7E8";
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'forfettario_pro_backup.json';

interface Window {
  gapi: any;
  google: any;
}
declare var window: Window;

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

/**
 * Inizializza le librerie Google (GAPI e GIS)
 */
export const initGoogleDrive = (updateSigninStatus: (avail: boolean) => void) => {
  const checkStatus = () => {
    // Verifichiamo che entrambi i moduli siano pronti e che l'API drive sia caricata
    if (gapiInited && gisInited && window.gapi?.client?.drive) {
      console.log("Google Drive System: PRONTO");
      updateSigninStatus(true);
    }
  };

  const initGapiClient = async () => {
    try {
      await window.gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      });
      // Forza il caricamento esplicito del modulo drive v3
      await window.gapi.client.load('drive', 'v3');
      gapiInited = true;
      checkStatus();
    } catch (err) {
      console.error("Errore inizializzazione GAPI client:", err);
    }
  };

  const gapiLoaded = () => {
    window.gapi.load('client', initGapiClient);
  };

  const gisLoaded = () => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Definito dinamicamente in handleAuthClick
      });
      gisInited = true;
      checkStatus();
    } catch (err) {
      console.error("Errore inizializzazione GIS client:", err);
    }
  };

  // Caricamento asincrono gestito con controllo presenza oggetti globali
  const pollForLibraries = () => {
    if (typeof window.gapi !== 'undefined' && !gapiInited) {
      gapiLoaded();
    }
    if (typeof window.google !== 'undefined' && window.google.accounts && !gisInited) {
      gisLoaded();
    }
    
    if (!gapiInited || !gisInited) {
      setTimeout(pollForLibraries, 500);
    }
  };

  pollForLibraries();
};

/**
 * Gestisce l'autenticazione tramite popup
 */
export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    if (!tokenClient) {
      return reject("Librerie Google non caricate correttamente. Ricarica la pagina.");
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        if (resp.error === 'access_denied') {
          alert("ERRORE GOOGLE DRIVE (403): Accesso Negato.\n\nL'app è in modalità test. Devi aggiungere 'Palmasstudio@gmail.com' agli UTENTI DI TEST nella Google Cloud Console (sezione Schermata Consenso OAuth).");
        }
        return reject(resp);
      }
      resolve();
    };

    const token = window.gapi.client.getToken();
    if (token === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

/**
 * Crea una cartella o ne recupera l'ID
 */
export const createFolder = async (name: string, parentId?: string) => {
  if (!window.gapi?.client?.drive) {
    throw new Error("Google Drive non è pronto. Attendi il caricamento o ricarica la pagina.");
  }

  const cleanName = name.replace(/'/g, "\\'");
  const query = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
  
  try {
    const existing = await window.gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });
    if (existing.result.files && existing.result.files.length > 0) {
      return existing.result.files[0].id;
    }

    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const response = await window.gapi.client.drive.files.create({ resource: metadata, fields: 'id' });
    return response.result.id;
  } catch (error) {
    console.error("Errore API Drive (createFolder):", error);
    throw error;
  }
};

/**
 * Crea la struttura cartelle Studio Palmas per un cliente
 */
export const createClientStructure = async (clientName: string) => {
  try {
    // Puntiamo alla cartella Master dello Studio
    const rootFolderId = await createFolder(clientName, MASTER_FOLDER_ID);
    
    const subfolders = [
      '01_Fatture_Emesse', 
      '02_Fatture_Acquisto_Spese', 
      '03_F24_Tasse_INPS', 
      '04_Contratti_Preventivi'
    ];

    for (const folderName of subfolders) {
      await createFolder(folderName, rootFolderId);
    }
    return rootFolderId;
  } catch (error) {
    console.error("Errore creazione struttura:", error);
    throw error;
  }
};

/**
 * Upload del backup JSON
 */
export const uploadBackup = async (data: any) => {
  if (!window.gapi?.client?.drive) throw new Error("API Drive non disponibile");
  
  const fileContent = JSON.stringify(data, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const accessToken = window.gapi.client.getToken()?.access_token;
  
  if (!accessToken) throw new Error("Utente non autenticato.");

  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });
  
  const files = response.result.files;
  const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });

  if (files && files.length > 0) {
    const fileId = files[0].id;
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', file);
    await fetch(url, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form });
    return { status: 'updated', id: fileId };
  } else {
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', file);
    const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form });
    const val = await res.json();
    return { status: 'created', id: val.id };
  }
};

/**
 * Download del backup JSON
 */
export const downloadBackup = async () => {
  if (!window.gapi?.client?.drive) throw new Error("API Drive non disponibile");
  const response = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false`, fields: 'files(id, name)' });
  const files = response.result.files;
  if (!files || files.length === 0) throw new Error("Nessun backup trovato su Drive.");
  const result = await window.gapi.client.drive.files.get({ fileId: files[0].id, alt: 'media' });
  return result.body;
};
