// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sequelize = require('./models');
const Person = require('./models/person');
const User = require('./models/user');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const os = require('os'); // os modülünü ekledik

let mainWindow;
let editPersonWindow;

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
  }

  createWindow();

  // Kullanıcı kaydı işlemi
  ipcMain.handle('register-user', async (event, userData) => {
    try {
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
    } catch (error) {
      console.error('Kullanıcı kaydı hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // Giriş işlemi
  ipcMain.handle('login', async (event, loginData) => {
    try {
      console.log('Gelen loginData:', loginData);
      const user = await User.findOne({ where: { username: loginData.username } });
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
      const user = await User.findOne({ where: { username } });
      if (user) {
        return user.toJSON();
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
      const person = await Person.create(personData);
      return person.toJSON();
    } catch (error) {
      console.error('Kişi ekleme hatası:', error);
      throw error;
    }
  });

  // Kişileri getirme işlemi
  ipcMain.handle('get-persons', async () => {
    try {
      const persons = await Person.findAll();
      return persons.map((person) => person.toJSON());
    } catch (error) {
      console.error('Kişileri getirme hatası:', error);
      throw error;
    }
  });

  // Kişi güncelleme işlemi
  ipcMain.handle('update-person', async (event, personId, updateData) => {
    try {
      await Person.update(updateData, { where: { id: personId } });
      return true;
    } catch (error) {
      console.error('Kişi güncelleme hatası:', error);
      throw error;
    }
  });

  // Kişi silme işlemi
  ipcMain.handle('delete-person', async (event, personId) => {
    try {
      await Person.destroy({ where: { id: personId } });
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
    Person.update(
      { name: updatedPerson.name, email: updatedPerson.email },
      { where: { id: updatedPerson.id } }
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
  const genAI = new GoogleGenerativeAI('AIzaSyAtfVVMY6-zxrmv3Qf5cNQzDBHaxmngu4Y'); // API anahtarınızı buraya ekleyin

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