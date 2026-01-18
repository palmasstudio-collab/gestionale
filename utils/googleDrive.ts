
// Utility to interact with Google Drive API v3

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'forfettario_pro_backup.json';

// ID della cartella Master "Studio Palmas" fornito dall'utente
const MASTER_FOLDER_ID = '1ogkOOPaH3EwYUV-DO-GHgZ0HswocM7E8';

// Interfaces for Google Global Objects
interface Window {
  gapi: any;
  google: any;
}

declare var window: Window;

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// 1. Initialize API and Clients
export const initGoogleDrive = (apiKey: string, clientId: string, updateSigninStatus: (avail: boolean) => void) => {
  if(!apiKey || !clientId) {
    console.warn("Google API Key or Client ID missing");
    return;
  }

  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: [DISCOVERY_DOC],
      });
      gapiInited = true;
      checkStatus();
    });
  }

  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: '', // defined later
    });
    gisInited = true;
    checkStatus();
  }

  const checkStatus = () => {
    if (gapiInited && gisInited) {
      updateSigninStatus(true);
    }
  }

  if (typeof window.gapi !== 'undefined') gapiLoaded();
  if (typeof window.google !== 'undefined') gisLoaded();
};

export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve();
    };
    
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
};

// --- FUNZIONI PER CARTELLE ---

/**
 * Crea una cartella su Google Drive o ne restituisce l'ID se esiste già nel genitore specificato
 */
export const createFolder = async (name: string, parentId?: string) => {
  // Pulizia nome per evitare problemi di query
  const cleanName = name.replace(/'/g, "\\'");
  
  // 1. Controlla se esiste già
  const query = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
  
  const existing = await window.gapi.client.drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });

  if (existing.result.files && existing.result.files.length > 0) {
    return existing.result.files[0].id;
  }

  // 2. Se non esiste, creala
  const metadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : []
  };

  const response = await window.gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id'
  });

  return response.result.id;
};

/**
 * Crea la struttura completa per un nuovo cliente all'interno della cartella Studio Palmas
 */
export const createClientStructure = async (clientName: string) => {
  try {
    // 1. Crea/Ottieni cartella principale Cliente dentro la cartella Studio Palmas
    const rootFolderId = await createFolder(clientName, MASTER_FOLDER_ID);
    
    // 2. Crea sottocartelle specifiche per Regime Forfettario
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
    console.error("Errore durante la creazione della struttura cartelle:", error);
    throw error;
  }
};

// --- FUNZIONI BACKUP ---

export const uploadBackup = async (data: any) => {
  const fileContent = JSON.stringify(data);
  const file = new Blob([fileContent], {type: 'application/json'});
  
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });
  
  const files = response.result.files;
  const accessToken = window.gapi.client.getToken().access_token;

  if (files && files.length > 0) {
    const fileId = files[0].id;
    const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', file);

    await fetch(url, {
      method: 'PATCH',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form
    });
    return { status: 'updated', id: fileId };
  } else {
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
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
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const files = response.result.files;
  if (!files || files.length === 0) throw new Error("Nessun backup trovato.");

  const fileId = files[0].id;
  const result = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });

  return result.body;
};
