// file-search.js

const searchInput = document.getElementById('searchInput');
const goButton = document.getElementById('goButton');
const fileList = document.getElementById('fileList');
const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const homeButton = document.getElementById('homeButton');
const recentPlaces = document.getElementById('recentPlaces');
const currentPathElement = document.getElementById('currentPath');
const listViewButton = document.getElementById('listViewButton');
const gridViewButton = document.getElementById('gridViewButton');

let currentPath = window.electronAPI.os.homedir();
let history = [];
let historyIndex = -1;
let recentPaths = [];
let isGridView = false; // Varsayılan olarak liste görünümü

goButton.addEventListener('click', () => {
  const command = searchInput.value.toLowerCase();
  const tokens = window.electronAPI.natural.tokenize(command);
  processCommand(tokens);
  searchInput.value = '';
});

// Enter tuşuna basıldığında arama yap
searchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    goButton.click();
  }
});

backButton.addEventListener('click', () => {
  if (historyIndex > 0) {
    historyIndex--;
    currentPath = history[historyIndex];
    listFiles(currentPath);
  }
});

forwardButton.addEventListener('click', () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    currentPath = history[historyIndex];
    listFiles(currentPath);
  }
});

homeButton.addEventListener('click', () => {
  navigateTo(window.electronAPI.os.homedir());
});

listViewButton.addEventListener('click', () => {
  isGridView = false;
  listFiles(currentPath);
});

gridViewButton.addEventListener('click', () => {
  isGridView = true;
  listFiles(currentPath);
});

fileList.addEventListener('click', async (event) => {
  const target = event.target.closest('.file-item');
  if (target && target.dataset.path) {
    const selectedPath = target.dataset.path;
    try {
      const stats = await window.electronAPI.fs.stat(selectedPath);
      if (stats.isDirectory) {
        navigateTo(selectedPath);
      } else {
        // Dosya ise açabilirsiniz
        window.electronAPI.shellOpenPath(selectedPath);
      }
    } catch (err) {
      console.error(err);
    }
  }
});

function processCommand(tokens) {
  if (tokens.includes('indirilenler') || tokens.includes('download') || tokens.includes('downloads')) {
    navigateTo(window.electronAPI.path.join(window.electronAPI.os.homedir(), 'Downloads'));
  } else if (tokens.includes('masaüstü') || tokens.includes('desktop')) {
    navigateTo(window.electronAPI.path.join(window.electronAPI.os.homedir(), 'Desktop'));
  } else if (tokens.includes('belgeler') || tokens.includes('documents')) {
    navigateTo(window.electronAPI.path.join(window.electronAPI.os.homedir(), 'Documents'));
  } else if (tokens.includes('geri')) {
    backButton.click();
  } else if (tokens.includes('ileri')) {
    forwardButton.click();
  } else if (tokens.includes('ana') && tokens.includes('dizin')) {
    homeButton.click();
  } else {
    searchFiles(tokens.join(' ')); // Tokens'ı tekrar string'e çeviriyoruz
  }
}

function navigateTo(newPath) {
  currentPath = newPath;
  if (history[historyIndex] !== currentPath) {
    history = history.slice(0, historyIndex + 1);
    history.push(currentPath);
    historyIndex++;
  }
  listFiles(currentPath);
  updateRecentPlaces(currentPath);
}

async function listFiles(dirPath) {
  // Mevcut dizini güncelle
  currentPathElement.textContent = dirPath;

  try {
    const files = await window.electronAPI.fs.readdir(dirPath, { withFileTypes: true });
    fileList.innerHTML = '';

    // Klasörleri ve dosyaları ayır
    const folders = files.filter((file) => file.isDirectory);
    const regularFiles = files.filter((file) => !file.isDirectory);

    // Klasörleri ve dosyaları birleştir, klasörler önce
    const sortedFiles = [...folders, ...regularFiles];

    sortedFiles.forEach((file) => {
      const fullPath = window.electronAPI.path.join(dirPath, file.name);
      const div = document.createElement('div');
      div.classList.add('file-item');
      div.dataset.path = fullPath;

      const icon = document.createElement('i');
      if (file.isDirectory) {
        icon.classList.add('fas', 'fa-folder', 'folder-icon');
      } else {
        icon.classList.add('fas', 'fa-file', 'file-icon');
      }
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.name;

      if (isGridView) {
        div.style.display = 'inline-block';
        div.style.width = '100px';
        div.style.textAlign = 'center';
        icon.style.fontSize = '48px';
        div.appendChild(icon);
        div.appendChild(document.createElement('br'));
        div.appendChild(nameSpan);
      } else {
        div.classList.add('list-group-item', 'list-group-item-action');
        div.prepend(icon);
        div.appendChild(nameSpan);
      }

      fileList.appendChild(div);
    });

   // Görünüm sınıfını ayarla
   if (isGridView) {
    fileList.classList.add('grid-view');
  } else {
    fileList.classList.remove('grid-view');
  }
} catch (err) {
  console.error(err);
  fileList.innerHTML = '<div>Bu dizine erişilemiyor.</div>';
}
}

function updateRecentPlaces(newPath) {
  if (!recentPaths.includes(newPath)) {
    recentPaths.unshift(newPath);
    if (recentPaths.length > 5) recentPaths.pop();
    renderRecentPlaces();
  }
}

function renderRecentPlaces() {
  recentPlaces.innerHTML = '';
  recentPaths.forEach((place) => {
    const div = document.createElement('a');
    div.textContent = place;
    div.dataset.path = place;
    div.classList.add('list-group-item', 'list-group-item-action');
    div.addEventListener('click', () => {
      navigateTo(place);
    });
    recentPlaces.appendChild(div);
  });
}


async function searchFiles(keyword) {
  fileList.innerHTML = '<div>Aranıyor...</div>';
  const results = [];

  // Arama derinliğini sınırlamak için maxDepth parametresi ekleyelim
  const maxDepth = 5; // Derinliği artırdık

  async function searchInDirectory(dir, depth) {
    if (depth > maxDepth) return;
    try {
      const files = await window.electronAPI.fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = window.electronAPI.path.join(dir, file.name);
        if (file.name.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({ name: file.name, path: fullPath, isDirectory: file.isDirectory });
        }
        if (file.isDirectory) {
          await searchInDirectory(fullPath, depth + 1);
        }
      }
    } catch (err) {
      // Hata durumunda devam et
    }
  }

  await searchInDirectory(currentPath, 0);

  if (results.length > 0) {
    fileList.innerHTML = '';

    results.forEach((result) => {
      const div = document.createElement('div');
      div.classList.add('file-item');
      div.dataset.path = result.path;

      const icon = document.createElement('i');
      if (result.isDirectory) {
        icon.classList.add('fas', 'fa-folder', 'folder-icon');
      } else {
        icon.classList.add('fas', 'fa-file', 'file-icon');
      }
      const nameSpan = document.createElement('span');
      nameSpan.textContent = result.name;

      if (isGridView) {
        div.style.display = 'inline-block';
        div.style.width = '100px';
        div.style.textAlign = 'center';
        icon.style.fontSize = '48px';
        div.appendChild(icon);
        div.appendChild(document.createElement('br'));
        div.appendChild(nameSpan);
      } else {
        div.classList.add('list-group-item', 'list-group-item-action');
        div.prepend(icon);
        div.appendChild(nameSpan);
      }

      fileList.appendChild(div);
    });


   // Görünüm sınıfını ayarla
   if (isGridView) {
    fileList.classList.add('grid-view');
  } else {
    fileList.classList.remove('grid-view');
  }
} else {
  fileList.innerHTML = '<div>Sonuç bulunamadı.</div>';
}
}

// Uygulama ilk açıldığında mevcut dizini listeleyin
navigateTo(currentPath);