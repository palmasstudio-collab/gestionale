
// Utility per l'integrazione con Google Drive & Sheets API - Studio Palmas

const CLIENT_ID = "459844148501-9fc3ns8fpd7dl7pcgmiodbnh53vd3hol.apps.googleusercontent.com"; 
const MASTER_FOLDER_ID = "1ogkOOPaH3EwYUV-DO-GHgZ0HswocM7E8";
const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SHEETS_DISCOVERY_DOC = 'https://blocks.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const BACKUP_FILENAME = 'forfettario_pro_backup.json';

interface Window {
  gapi: any;
  google: any;
}
declare var window: Window;

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleDrive = (updateSigninStatus: (avail: boolean) => void) => {
  const checkStatus = () => {
    if (gapiInited && gisInited && window.gapi?.client?.drive && window.gapi?.client?.sheets) {
      console.log("Google Systems: PRONTI (Drive + Sheets)");
      updateSigninStatus(true);
    }
  };

  const initGapiClient = async () => {
    try {
      await window.gapi.client.init({
        discoveryDocs: [DRIVE_DISCOVERY_DOC, 'https://sheets.googleapis.com/$discovery/rest?version=v4'],
      });
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
        callback: '', 
      });
      gisInited = true;
      checkStatus();
    } catch (err) {
      console.error("Errore inizializzazione GIS client:", err);
    }
  };

  const pollForLibraries = () => {
    if (typeof window.gapi !== 'undefined' && !gapiInited) gapiLoaded();
    if (typeof window.google !== 'undefined' && window.google.accounts && !gisInited) gisLoaded();
    if (!gapiInited || !gisInited) setTimeout(pollForLibraries, 500);
  };

  pollForLibraries();
};

export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    if (!tokenClient) return reject("Librerie Google non caricate.");

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        if (resp.error === 'access_denied') {
          alert("ERRORE: Accesso Negato. Aggiungi la tua email agli UTENTI DI TEST nella Cloud Console.");
        }
        return reject(resp);
      }
      resolve();
    };

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const createFolder = async (name: string, parentId?: string) => {
  const cleanName = name.replace(/'/g, "\\'");
  const query = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
  const existing = await window.gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });
  if (existing.result.files && existing.result.files.length > 0) return existing.result.files[0].id;

  const metadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] };
  const response = await window.gapi.client.drive.files.create({ resource: metadata, fields: 'id' });
  return response.result.id;
};

// --- NUOVE FUNZIONI SHEETS ---

export const createDatabaseSpreadsheet = async (clientName: string, parentId: string) => {
  try {
    const title = `Database_Fiscale_${clientName}`;
    
    // 1. Crea lo spreadsheet
    const spreadsheet = await window.gapi.client.sheets.spreadsheets.create({
      resource: {
        properties: { title: title },
        sheets: [{
          properties: { title: 'Fatture' }
        }]
      }
    });

    const spreadsheetId = spreadsheet.result.spreadsheetId;

    // 2. Sposta il file nella cartella del cliente (Drive API)
    await window.gapi.client.drive.files.update({
      fileId: spreadsheetId,
      addParents: parentId,
      removeParents: 'root',
      fields: 'id, parents'
    });

    // 3. Aggiungi intestazione riga 1
    const headers = [['Data Incasso', 'N. Fattura', 'Cliente Finale', 'Imponibile (€)', 'Cassa/Rivalsa (€)', 'Totale (€)', 'Stato']];
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Fatture!A1:G1',
      valueInputOption: 'RAW',
      resource: { values: headers }
    });

    console.log(`Spreadsheet creato con successo: ${title}`);
    return spreadsheetId;
  } catch (err) {
    console.error("Errore creazione Spreadsheet:", err);
    throw err;
  }
};

export const syncInvoiceToSpreadsheet = async (spreadsheetId: string, invoice: any) => {
  try {
    const row = [[
      invoice.paymentDate || invoice.date,
      invoice.number,
      invoice.clientName,
      invoice.taxableAmount,
      invoice.cassaAmount,
      invoice.amount,
      invoice.status
    ]];

    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'Fatture!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: row }
    });
    
    console.log("Fattura sincronizzata sul Database Google Sheets.");
  } catch (err) {
    console.error("Errore sincronizzazione Sheets:", err);
    // Non blocchiamo l'app se Sheets fallisce, ma logghiamo
  }
};

export const createClientStructure = async (clientName: string) => {
  const rootFolderId = await createFolder(clientName, MASTER_FOLDER_ID);
  const subfolders = ['01_Fatture_Emesse', '02_Fatture_Acquisto_Spese', '03_F24_Tasse_INPS', '04_Contratti_Preventivi'];
  for (const folderName of subfolders) {
    await createFolder(folderName, rootFolderId);
  }
  
  // Crea anche il Database Excel (Sheets)
  const spreadsheetId = await createDatabaseSpreadsheet(clientName, rootFolderId);
  
  return { rootFolderId, spreadsheetId };
};

export const uploadBackup = async (data: any) => {
  if (!window.gapi?.client?.drive) throw new Error("API Drive non disponibile");
  const fileContent = JSON.stringify(data, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const accessToken = window.gapi.client.getToken()?.access_token;
  if (!accessToken) throw new Error("Utente non autenticato.");

  const response = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false`, fields: 'files(id, name)' });
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

export const downloadBackup = async () => {
  if (!window.gapi?.client?.drive) throw new Error("API Drive non disponibile");
  const response = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false`, fields: 'files(id, name)' });
  const files = response.result.files;
  if (!files || files.length === 0) throw new Error("Nessun backup trovato su Drive.");
  const result = await window.gapi.client.drive.files.get({ fileId: files[0].id, alt: 'media' });
  return result.body;
};
