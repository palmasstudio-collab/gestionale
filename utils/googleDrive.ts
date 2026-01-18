// --- utils/googleDrive.ts ---

// CONFIGURAZIONE
// ---------------------------------------------------------
// IL TUO CLIENT ID (Inserito correttamente)
const CLIENT_ID = "459844148501-9fc3ns8fpd7dl7pcgmiodbnh53vd3hol.apps.googleusercontent.com"; 

// Lascia vuoto se non hai creato una API KEY (non è obbligatoria con OAuth)
const API_KEY = ""; 

// Configurazione standard di Google
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'forfettario_pro_backup.json';

// Interfacce per TypeScript
interface Window {
  gapi: any;
  google: any;
}
declare var window: Window;

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// 1. INIZIALIZZAZIONE (Carica le librerie)
export const initGoogleDrive = (updateSigninStatus: (avail: boolean) => void) => {
  
  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      gapiInited = true;
      console.log("GAPI (Modulo Client) caricato.");
      checkStatus();
    });
  }

  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // Definito al momento del click
    });
    gisInited = true;
    console.log("GIS (Modulo Login) caricato.");
    checkStatus();
  }

  const checkStatus = () => {
    if (gapiInited && gisInited) {
      console.log("Google Drive System: PRONTO");
      updateSigninStatus(true);
    }
  }

  // Carica gli script se presenti nella pagina
  if (typeof window.gapi !== 'undefined') gapiLoaded();
  if (typeof window.google !== 'undefined') gisLoaded();
};

// 2. GESTIONE LOGIN (Popup)
export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    if (!tokenClient) {
      reject("Google Library non ancora caricata. Ricarica la pagina.");
      return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      console.log("Login effettuato con successo!");
      resolve();
    };

    // Richiede il token (forza il popup se serve, o lo rinnova silenziamente)
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
};

// 3. FUNZIONI DRIVE

// Crea una cartella
export const createFolder = async (name: string, parentId?: string) => {
  // CONTROLLO FONDAMENTALE PER EVITARE L'ERRORE "UNDEFINED"
  if (!window.gapi || !window.gapi.client || !window.gapi.client.drive) {
    throw new Error("Google Drive non è pronto. Attendi il caricamento o ricarica la pagina.");
  }

  const cleanName = name.replace(/'/g, "\\'");
  
  // Cerca se esiste già
  const query = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
  
  try {
    const existing = await window.gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });

    if (existing.result.files && existing.result.files.length > 0) {
      console.log(`Cartella esistente trovata: ${name}`);
      return existing.result.files[0].id;
    }

    // Se non esiste, crea
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const response = await window.gapi.client.drive.files.create({ resource: metadata, fields: 'id' });
    console.log(`Cartella creata: ${name}`);
    return response.result.id;

  } catch (error) {
    console.error("Errore creazione cartella:", error);
    throw error;
  }
};

// STRUTTURA CLIENTE (Quella che volevi tu)
export const createClientStructure = async (clientName: string) => {
  try {
    console.log(`Inizio creazione struttura per: ${clientName}`);
    
    // 1. Crea cartella Padre (es. "Mario Rossi - 2024")
    const rootFolderId = await createFolder(clientName);
    
    // 2. Crea sottocartelle
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
    console.error("Errore durante la creazione della struttura cliente:", error);
    throw error;
  }
};

// SALVATAGGIO BACKUP (JSON)
export const uploadBackup = async (data: any) => {
  if (!window.gapi.client.drive) throw new Error("Drive API non caricata");

  const fileContent = JSON.stringify(data, null, 2); // Formattato leggibile
  const file = new Blob([fileContent], {type: 'application/json'});
  
  // Cerca se esiste il file di backup
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });
  
  const files = response.result.files;
  const accessToken = window.gapi.client.getToken().access_token;

  const metadataBlob = new Blob([JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' });

  if (files && files.length > 0) {
    // AGGIORNA file esistente
    const fileId = files[0].id;
    const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', file);
    
    await fetch(url, { 
      method: 'PATCH', 
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }), 
      body: form 
    });
    return { status: 'updated', id: fileId };
  } else {
    // CREA nuovo file
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', file);
    
    const res = await fetch(url, { 
      method: 'POST', 
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }), 
      body: form 
    });
    const val = await res.json();
    return { status: 'created', id: val.id };
  }
};

export const downloadBackup = async () => {
  if (!window.gapi.client.drive) throw new Error("Drive API non caricata");

  const response = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false`, fields: 'files(id, name)' });
  const files = response.result.files;
  if (!files || files.length === 0) throw new Error("Nessun backup trovato.");
  
  const result = await window.gapi.client.drive.files.get({ fileId: files[0].id, alt: 'media' });
  return result.body;
};
