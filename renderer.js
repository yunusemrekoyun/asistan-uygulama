// renderer.js

// Kamera ve yüz tanıma fonksiyonları
async function setupCamera(selectedDeviceId) {
  const video = document.getElementById('video');
  if (window.stream) {
    window.stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  try {
    const constraints = {
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    window.stream = stream;
    video.srcObject = stream;
  } catch (error) {
    console.error('Kamera erişimi hatası:', error);
    alert('Kameraya erişilemiyor. Lütfen izin verdiğinizden emin olun.');
  }
}

async function getCameraDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoSelect = document.getElementById('video-source');
    videoSelect.innerHTML = '';

    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    videoDevices.forEach((device) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Kamera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    });

    if (videoDevices.length > 0) {
      await setupCamera(videoDevices[0].deviceId);
    }
  } catch (error) {
    console.error('Kamera cihazlarını alma hatası:', error);
  }
}

document.getElementById('video-source').addEventListener('change', async (event) => {
  const selectedDeviceId = event.target.value;
  await setupCamera(selectedDeviceId);
});

// Modelleri yükleme fonksiyonu
async function loadModels() {
  const MODEL_URL =
    'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
}

// Yüz ile giriş yapma butonu
document.getElementById('face-login-button').addEventListener('click', async () => {
  const username = document.getElementById('face-username').value.trim();
  if (!username) {
    alert('Lütfen kullanıcı adınızı girin.');
    return;
  }

  try {
    const user = await window.electronAPI.getUserByUsername(username);
    if (!user || !user.faceDescriptor) {
      alert('Kullanıcı bulunamadı veya yüz verisi yok.');
      return;
    }

    const video = document.getElementById('video');
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detections) {
      const distance = faceapi.euclideanDistance(
        detections.descriptor,
        new Float32Array(JSON.parse(user.faceDescriptor))
      );
      if (distance < 0.6) {
        window.location.href = 'home.html';
      } else {
        alert('Yüz eşleşmedi. Lütfen tekrar deneyin.');
      }
    } else {
      alert('Yüz algılanamadı. Lütfen tekrar deneyin.');
    }
  } catch (error) {
    console.error('Yüz tanıma hatası:', error);
    alert('Yüz tanıma sırasında bir hata oluştu.');
  }
});

// Normal giriş işlemi
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  window.electronAPI
    .login({ username, password })
    .then((response) => {
      if (response.success) {
        window.location.href = 'home.html';
      } else {
        const errorMessage = document.getElementById('error-message');
        errorMessage.innerText = response.message || 'Giriş sırasında bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    })
    .catch((err) => {
      console.error('Giriş işlemi hatası:', err);
    });
});

// Sayfa yüklendiğinde modelleri ve kamera cihazlarını başlat
window.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  await getCameraDevices();
});