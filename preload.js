// preload.js

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const natural = require('natural'); // natural modülünü ekledik

contextBridge.exposeInMainWorld('electronAPI', {
  // Kullanıcı kayıt ve giriş fonksiyonları
  registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
  login: (loginData) => ipcRenderer.invoke('login', loginData),
  getUserByUsername: (username) => ipcRenderer.invoke('get-user-by-username', username),

  // Kişi yönetimi fonksiyonları
  addPerson: (personData) => ipcRenderer.invoke('add-person', personData),
  getPersons: () => ipcRenderer.invoke('get-persons'),
  updatePerson: (personId, updateData) => ipcRenderer.invoke('update-person', personId, updateData),
  deletePerson: (personId) => ipcRenderer.invoke('delete-person', personId),

  // Kişi düzenleme penceresi fonksiyonları
  openEditPersonWindow: (person) => ipcRenderer.send('open-edit-person-window', person),
  onPersonUpdated: (callback) => ipcRenderer.on('person-updated', callback),

  // Düzenleme penceresi için fonksiyonlar
  onPersonData: (callback) => ipcRenderer.on('person-data', callback),
  sendPersonUpdated: (updatedPerson) => ipcRenderer.send('person-updated', updatedPerson),

  // Gemini AI ile sohbet fonksiyonu
  sendMessageToGemini: (prompt) => ipcRenderer.invoke('chat-with-gemini', prompt),

  // OS modülünü expose ediyoruz
  os: {
    homedir: () => os.homedir(),
  },

  // Dosya sistemi fonksiyonları
  fs: {
    readdir: (dirPath, options) => ipcRenderer.invoke('fs-readdir', dirPath, options),
    stat: (filePath) => ipcRenderer.invoke('fs-stat', filePath),
  },
  path: {
    join: (...args) => ipcRenderer.invoke('path-join', ...args),
  },

  natural: {
    tokenize: (text) => {
      const tokenizer = new natural.WordTokenizer();
      return tokenizer.tokenize(text);
    },
  },
});