// register.js

let faceDescriptor = null;

async function setupCamera(selectedDeviceId) {
  const video = document.getElementById('video');
  if (window.stream) {
    // Mevcut video akışını durdur
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
    window.stream = stream; // Akışı global değişkene atıyoruz ki durdurabilelim
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

    // Eğer kamera varsa, ilkini seçip başlatalım
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

// Yüz kaydetme butonu
document.getElementById('capture-face').addEventListener('click', async () => {
  const video = document.getElementById('video');
  try {
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detections) {
      faceDescriptor = Array.from(detections.descriptor);
      alert('Yüz kaydı başarıyla alındı.');
    } else {
      alert('Yüz algılanamadı. Lütfen tekrar deneyin.');
    }
  } catch (error) {
    console.error('Yüz algılama hatası:', error);
    alert('Yüz algılama sırasında bir hata oluştu.');
  }
});

// Kayıt formu işlemi
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!faceDescriptor) {
    alert('Lütfen yüz kaydı alın.');
    return;
  }

  window.electronAPI
    .registerUser({ username, password, faceDescriptor })
    .then((response) => {
      if (response.success) {
        alert('Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz.');
        window.location.href = 'index.html';
      } else {
        const errorMessage = document.getElementById('error-message');
        errorMessage.innerText = response.message || 'Kayıt sırasında bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    })
    .catch((err) => {
      console.error('Kayıt işlemi hatası:', err);
    });
});

// Sayfa yüklendiğinde modelleri ve kamera cihazlarını başlat
window.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  await getCameraDevices();
});