
// Utility to interact with Google Drive API v3

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'forfettario_pro_backup.json';

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

  // Check if scripts are loaded
  if (typeof window.gapi !== 'undefined') gapiLoaded();
  if (typeof window.google !== 'undefined') gisLoaded();
};

// 2. Handle Login
export const handleAuthClick = async () => {
  return new Promise<void>((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve();
    };
    
    // Request access token
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
};

// 3. Upload File (Create or Update)
export const uploadBackup = async (data: any) => {
  const fileContent = JSON.stringify(data);
  const file = new Blob([fileContent], {type: 'application/json'});
  
  // Check if file exists
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });
  
  const files = response.result.files;
  
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
  };

  const accessToken = window.gapi.client.getToken().access_token;

  if (files && files.length > 0) {
    // Update existing file
    const fileId = files[0].id;
    const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart';
    
    // Use raw fetch for upload because gapi client logic for multipart is verbose
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
    // Create new file
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
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

// 4. Download File
export const downloadBackup = async () => {
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const files = response.result.files;
  if (!files || files.length === 0) {
    throw new Error("Nessun backup trovato.");
  }

  const fileId = files[0].id;
  const result = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });

  return result.body; // JSON string
};
