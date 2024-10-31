// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
  login: (loginData) => ipcRenderer.invoke('login', loginData),
  addPerson: (personData) => ipcRenderer.invoke('add-person', personData),
  getPersons: () => ipcRenderer.invoke('get-persons'),
  updatePerson: (personId, updateData) => ipcRenderer.invoke('update-person', personId, updateData),
  deletePerson: (personId) => ipcRenderer.invoke('delete-person', personId),
  openEditPersonWindow: (person) => ipcRenderer.send('open-edit-person-window', person),
  onPersonUpdated: (callback) => ipcRenderer.on('person-updated', callback),
  onPersonData: (callback) => ipcRenderer.on('person-data', callback),
  sendPersonUpdated: (updatedPerson) => ipcRenderer.send('person-updated', updatedPerson),
  getUserByUsername: (username) => ipcRenderer.invoke('get-user-by-username', username),
  sendMessageToGemini: (prompt) => ipcRenderer.invoke('chat-with-gemini', prompt),

});Si