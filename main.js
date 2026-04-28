// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sequelize = require('./models');
const Person = require('./models/person');
const User = require('./models/user');
const FallbackStore = require('./fallback-store');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const os = require('os'); // os modülünü ekledik

let mainWindow;
let editPersonWindow;
let fallbackActive = false;
let fallbackStore = null;

// Express uygulaması oluştur
const expressApp = express();
expressApp.use('/face_models', express.static(path.join(__dirname, 'face_models')));

const server = expressApp.listen(3000, () => {
  console.log('Express sunucusu 3000 portunda çalışıyor.');
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile('index.html');
}

function createEditPersonWindow() {
  editPersonWindow = new BrowserWindow({
    width: 400,
    height: 400,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  editPersonWindow.loadFile('edit-person.html');

  editPersonWindow.once('ready-to-show', () => {
    editPersonWindow.show();
  });

  editPersonWindow.on('closed', () => {
    editPersonWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    
    await sequelize.authenticate();
    console.log('Veritabanı bağlantısı başarılı.');

    // Modelleri senkronize et
    await sequelize.sync({ alter: true });
    console.log('Modeller senkronize edildi.');
  } catch (error) {
    console.error('Veritabanı bağlantısı başarısız:', error);
    await activateFallback(error);
  }

  createWindow();

  // Kullanıcı kaydı işlemi
  ipcMain.handle('register-user', async (event, userData) => {
    try {
      return await withFallback(
        async () => {
          const existingUser = await User.findOne({ where: { username: userData.username } });
          if (existingUser) {
            throw new Error('Bu kullanıcı adı zaten alınmış.');
          }
          const saltRounds = 10;
          const passwordHash = await bcrypt.hash(userData.password, saltRounds);
          await User.create({
            username: userData.username,
            passwordHash,
            faceDescriptor: userData.faceDescriptor,
          });
          return { success: true };
        },
        async () => {
          const existingUser = await fallbackStore.findUserByUsername(userData.username);
          if (existingUser) {
            throw new Error('Bu kullanıcı adı zaten alınmış.');
          }
          const saltRounds = 10;
          const passwordHash = await bcrypt.hash(userData.password, saltRounds);
          await fallbackStore.createUser({
            username: userData.username,
            passwordHash,
            faceDescriptor: userData.faceDescriptor,
          });
          return { success: true };
        }
      );
    } catch (error) {
      console.error('Kullanıcı kaydı hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // Giriş işlemi
  ipcMain.handle('login', async (event, loginData) => {
    try {
      console.log('Gelen loginData:', loginData);
      const user = await withFallback(
        async () => User.findOne({ where: { username: loginData.username } }),
        async () => fallbackStore.findUserByUsername(loginData.username)
      );
      console.log('Bulunan kullanıcı:', user);
      if (!user) {
        return { success: false, message: 'Kullanıcı bulunamadı.' };
      }
      const match = await bcrypt.compare(loginData.password, user.passwordHash);
      console.log('Parola eşleşmesi:', match);
      if (match) {
        return { success: true };
      } else {
        return { success: false, message: 'Parola yanlış.' };
      }
    } catch (error) {
      console.error('Giriş işlemi hatası:', error);
      return { success: false, message: 'Giriş işlemi sırasında bir hata oluştu.' };
    }
  });

  // Kullanıcıyı kullanıcı adına göre getirme (Yüz tanıma için)
  ipcMain.handle('get-user-by-username', async (event, username) => {
    try {
      const user = await withFallback(
        async () => User.findOne({ where: { username } }),
        async () => fallbackStore.findUserByUsername(username)
      );
      if (user) {
        return user.toJSON ? user.toJSON() : user;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Kullanıcı getirme hatası:', error);
      return null;
    }
  });

  // Kişi ekleme işlemi
  ipcMain.handle('add-person', async (event, personData) => {
    try {
      const person = await withFallback(
        async () => Person.create(personData),
        async () => fallbackStore.createPerson(personData)
      );
      return person.toJSON ? person.toJSON() : person;
    } catch (error) {
      console.error('Kişi ekleme hatası:', error);
      throw error;
    }
  });

  // Kişileri getirme işlemi
  ipcMain.handle('get-persons', async () => {
    try {
      const persons = await withFallback(
        async () => Person.findAll(),
        async () => fallbackStore.listPersons()
      );
      return persons.map((person) => (person.toJSON ? person.toJSON() : person));
    } catch (error) {
      console.error('Kişileri getirme hatası:', error);
      throw error;
    }
  });

  // Kişi güncelleme işlemi
  ipcMain.handle('update-person', async (event, personId, updateData) => {
    try {
      await withFallback(
        async () => Person.update(updateData, { where: { id: personId } }),
        async () => fallbackStore.updatePerson(personId, updateData)
      );
      return true;
    } catch (error) {
      console.error('Kişi güncelleme hatası:', error);
      throw error;
    }
  });

  // Kişi silme işlemi
  ipcMain.handle('delete-person', async (event, personId) => {
    try {
      await withFallback(
        async () => Person.destroy({ where: { id: personId } }),
        async () => fallbackStore.deletePerson(personId)
      );
      return true;
    } catch (error) {
      console.error('Kişi silme hatası:', error);
      throw error;
    }
  });

  // Düzenleme penceresini açma işlemi
  ipcMain.on('open-edit-person-window', (event, person) => {
    if (!editPersonWindow) {
      createEditPersonWindow();
      // Kişi verilerini düzenleme penceresine gönder
      editPersonWindow.webContents.on('did-finish-load', () => {
        editPersonWindow.webContents.send('person-data', person);
      });
    }
  });

  // Güncellenen kişi verilerini alma işlemi
  ipcMain.on('person-updated', (event, updatedPerson) => {
    // Veritabanını güncelle
    const updatePayload = { name: updatedPerson.name, email: updatedPerson.email };
    withFallback(
      async () => Person.update(updatePayload, { where: { id: updatedPerson.id } }),
      async () => fallbackStore.updatePerson(updatedPerson.id, updatePayload)
    )
      .then(() => {
        // Ana pencereye güncelleme bildirimi gönder
        mainWindow.webContents.send('person-updated');
        // Düzenleme penceresini kapat
        if (editPersonWindow) {
          editPersonWindow.close();
        }
      })
      .catch((error) => {
        console.error('Kişi güncelleme hatası:', error);
      });
  });

  // Gemini AI Entegrasyonu
  const genAI = new GoogleGenerativeAI('API KEY'); // API anahtarınızı buraya ekleyin

  ipcMain.handle('chat-with-gemini', async (event, prompt) => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('AI yanıtı alma hatası:', error);
      return 'İsteğiniz işlenirken bir hata oluştu.';
    }
  });

  // fs.readdir fonksiyonunu expose ediyoruz
  ipcMain.handle('fs-readdir', async (event, dirPath, options) => {
    return new Promise((resolve, reject) => {
      fs.readdir(dirPath, options, (err, files) => {
        if (err) {
          reject(err);
        } else {
          if (options.withFileTypes) {
            // Dirent nesnelerini serialize ediyoruz
            const serializedFiles = files.map((file) => ({
              name: file.name,
              isDirectory: file.isDirectory(),
              isFile: file.isFile(),
            }));
            resolve(serializedFiles);
          } else {
            resolve(files);
          }
        }
      });
    });
  });

  // fs.stat fonksiyonunu expose ediyoruz
  ipcMain.handle('fs-stat', async (event, filePath) => {
    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          // Stats nesnesini serialize ediyoruz
          resolve({
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            size: stats.size,
            // Diğer gerekli özellikleri ekleyebilirsiniz
          });
        }
      });
    });
  });


  // path.join fonksiyonunu expose ediyoruz
 /* ipcMain.handle('path-join', (event, ...args) => {
    return path.join(...args);
  });
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });*/
});
 // shell.openPath fonksiyonunu expose ediyoruz
 ipcMain.handle('shell-open-path', async (event, pathToOpen) => {
  try {
    await shell.openPath(pathToOpen);
    return true;
  } catch (error) {
    console.error('Dosya açılamadı:', error);
    return false;
  }
});
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', function () {
  // Express sunucusunu kapat
  server.close();
  if (process.platform !== 'darwin') app.quit();
});

function isConnectionError(error) {
  if (!error) {
    return false;
  }
  const name = error.name || '';
  const code = error.parent && error.parent.code ? error.parent.code : '';
  const message = error.message || '';
  if (code && ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(code)) {
    return true;
  }
  if (name.includes('Connection') || name.includes('HostNotFound')) {
    return true;
  }
  return /connection/i.test(message) && /refused|failed|not.*connect|terminat|timeout/i.test(message);
}

async function activateFallback(reason) {
  if (fallbackActive) {
    return;
  }
  fallbackActive = true;
  const fallbackPath = path.join(app.getPath('userData'), 'fallback-db.json');
  fallbackStore = new FallbackStore(fallbackPath);
  await fallbackStore.load();
  console.warn('Fallback storage active. Reason:', reason && reason.message ? reason.message : reason);
}

async function withFallback(dbFn, fallbackFn) {
  if (fallbackActive) {
    return fallbackFn();
  }
  try {
    return await dbFn();
  } catch (error) {
    if (isConnectionError(error)) {
      console.error('Veritabanı hatası, fallback aktif ediliyor:', error);
      await activateFallback(error);
      return fallbackFn();
    }
    throw error;
  }
}
