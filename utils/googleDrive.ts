
// Utility per l'integrazione con Google Drive & Sheets API - Studio Palmas

const CLIENT_ID = "459844148501-9fc3ns8fpd7dl7pcgmiodbnh53vd3hol.apps.googleusercontent.com"; 
const MASTER_FOLDER_ID = "1ogkOOPaH3EwYUV-DO-GHgZ0HswocM7E8";
const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SHEETS_DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

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
      updateSigninStatus(true);
    }
  };

  const initGapiClient = async () => {
    try {
      await window.gapi.client.init({});
      await window.gapi.client.load(DRIVE_DISCOVERY_DOC);
      await window.gapi.client.load(SHEETS_DISCOVERY_DOC);
      gapiInited = true;
      checkStatus();
    } catch (err) {
      console.error("Errore GAPI:", err);
    }
  };

  const gapiLoaded = () => window.gapi.load('client', initGapiClient);
  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '',
    });
    gisInited = true;
    checkStatus();
  };

  const poll = () => {
    if (typeof window.gapi !== 'undefined' && !gapiInited) gapiLoaded();
    if (typeof window.google !== 'undefined' && window.google.accounts && !gisInited) gisLoaded();
    if (!gapiInited || !gisInited) setTimeout(poll, 500);
  };
  poll();
};

export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    if (!tokenClient) return reject("Client non caricato.");
    tokenClient.callback = (resp: any) => resp.error ? reject(resp) : resolve();
    tokenClient.requestAccessToken({ prompt: window.gapi.client.getToken() === null ? 'consent' : '', enable_serial_consent: true });
  });
};

export const createFolder = async (name: string, parentId?: string) => {
  const cleanName = name.replace(/'/g, "\\'");
  const q = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
  const res = await window.gapi.client.drive.files.list({ q, fields: 'files(id, name)' });
  if (res.result.files?.length > 0) return res.result.files[0].id;
  const metadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] };
  const created = await window.gapi.client.drive.files.create({ resource: metadata, fields: 'id' });
  return created.result.id;
};

/**
 * Trova una sottocartella specifica per nome
 */
export const findSubfolderId = async (parentId: string, folderName: string) => {
  const q = `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await window.gapi.client.drive.files.list({ q, fields: 'files(id)' });
  return res.result.files?.[0]?.id || null;
};

/**
 * Upload fisico di un file su Drive
 */
export const uploadFileToDrive = async (file: File, folderId: string) => {
  const accessToken = window.gapi.client.getToken()?.access_token;
  if (!accessToken) throw new Error("Manca autenticazione Google.");

  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form
  });

  if (!res.ok) throw new Error("Errore durante l'upload del file.");
  const data = await res.json();
  return data.id;
};

export const createDatabaseSpreadsheet = async (clientName: string, parentId: string) => {
  const title = `Database_Fiscale_${clientName}`;
  const spreadsheet = await window.gapi.client.sheets.spreadsheets.create({
    resource: { properties: { title }, sheets: [{ properties: { title: 'Fatture' } }] }
  });
  const spreadsheetId = spreadsheet.result.spreadsheetId;
  await window.gapi.client.drive.files.update({ fileId: spreadsheetId, addParents: parentId, removeParents: 'root' });
  const headers = [['Data Incasso', 'N. Fattura', 'Cliente Finale', 'Imponibile (€)', 'Cassa/Rivalsa (€)', 'Totale (€)', 'Stato']];
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId, range: 'Fatture!A1:G1', valueInputOption: 'RAW', resource: { values: headers }
  });
  return spreadsheetId;
};

export const syncInvoiceToSpreadsheet = async (spreadsheetId: string, invoice: any) => {
  const row = [[invoice.paymentDate || invoice.date, invoice.number, invoice.clientName, invoice.taxableAmount, invoice.cassaAmount, invoice.amount, invoice.status]];
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId, range: 'Fatture!A2', valueInputOption: 'USER_ENTERED', resource: { values: row }
  });
};

export const createClientStructure = async (clientName: string) => {
  const rootFolderId = await createFolder(clientName, MASTER_FOLDER_ID);
  const subfolders = ['01_Fatture_Emesse', '02_Fatture_Acquisto_Spese', '03_F24_Tasse_INPS', '04_Contratti_Preventivi'];
  for (const name of subfolders) await createFolder(name, rootFolderId);
  const spreadsheetId = await createDatabaseSpreadsheet(clientName, rootFolderId);
  return { rootFolderId, spreadsheetId };
};

export const uploadBackup = async (data: any) => {
  const content = JSON.stringify(data, null, 2);
  const file = new Blob([content], { type: 'application/json' });
  const accessToken = window.gapi.client.getToken()?.access_token;
  const existing = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false` });
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
  form.append('file', file);

  if (existing.result.files?.length > 0) {
    const id = existing.result.files[0].id;
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form
    });
  } else {
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form
    });
  }
};

export const downloadBackup = async () => {
  const res = await window.gapi.client.drive.files.list({ q: `name = '${BACKUP_FILENAME}' and trashed = false` });
  if (!res.result.files?.length) throw new Error("Backup non trovato.");
  const file = await window.gapi.client.drive.files.get({ fileId: res.result.files[0].id, alt: 'media' });
  return file.body;
};
