// chat.js

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

// İçerik formatlama fonksiyonu
function formatContent(content) {
  const elements = [];
  let lastIndex = 0;

  // Düzenli ifadeler
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const boldTextRegex = /\*\*([^\*]+)\*\*/g;

  // Önce kod bloklarını işle
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Kod bloğundan önceki metni işle
    if (match.index > lastIndex) {
      const textSegment = content.substring(lastIndex, match.index);
      const formattedText = processBoldText(textSegment);
      elements.push(...formattedText);
    }

    // Kod bloğunu ekle
    const code = match[1];
    const codeElement = document.createElement('pre');
    codeElement.className = 'code-block';
    codeElement.textContent = code;
    elements.push(codeElement);

    lastIndex = codeBlockRegex.lastIndex;
  }

  // Kod bloğundan sonraki metni işle
  if (lastIndex < content.length) {
    const textSegment = content.substring(lastIndex);
    const formattedText = processBoldText(textSegment);
    elements.push(...formattedText);
  }

  return elements;
}

// Çift yıldız arasındaki metinleri işleyen fonksiyon
function processBoldText(text) {
  const elements = [];
  let lastIndex = 0;
  let match;
  const boldTextRegex = /\*\*([^\*]+)\*\*/g;

  while ((match = boldTextRegex.exec(text)) !== null) {
    // Çift yıldızdan önceki metni al
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      if (normalText.trim()) {
        const textElement = document.createElement('p');
        textElement.textContent = normalText.trim();
        elements.push(textElement);
      }
    }

    // Çift yıldız arasındaki metni büyük harfe çevir ve ekle
    const boldText = match[1].toUpperCase();
    const boldElement = document.createElement('p');
    boldElement.textContent = boldText;
    boldElement.className = 'bold-text';
    elements.push(boldElement);

    // Bir satır boşluk ekle
    elements.push(document.createElement('br'));

    lastIndex = boldTextRegex.lastIndex;
  }

  // Sonraki metni ekle
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex).trim();
    if (remainingText) {
      const textElement = document.createElement('p');
      textElement.textContent = remainingText;
      elements.push(textElement);
    }
  }

  return elements;
}

// Mesaj öğesi oluşturma fonksiyonu
function createMessageElement(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

  if (isUser) {
    messageDiv.textContent = content;
  } else {
    const previewElements = formatContent(content);
    const fullResponseDiv = document.createElement('div');
    fullResponseDiv.className = 'full-response';

    // Ön izleme için ilk birkaç öğeyi gösterelim (isteğe bağlı)
    previewElements.forEach((el) => {
      messageDiv.appendChild(el.cloneNode(true));
    });

    // Tam yanıt için aynı işlemi yapıyoruz
    const fullContentElements = formatContent(content);
    fullContentElements.forEach((el) => {
      fullResponseDiv.appendChild(el);
    });

    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-button btn btn-secondary btn-sm mt-2';
    toggleButton.textContent = 'Tüm Metni Görüntüle';

    toggleButton.addEventListener('click', () => {
      fullResponseDiv.classList.toggle('show');
      toggleButton.textContent = fullResponseDiv.classList.contains('show')
        ? 'Tam Metni Gizle'
        : 'Tüm Metni Görüntüle';
    });

    messageDiv.appendChild(toggleButton);
    messageDiv.appendChild(fullResponseDiv);
  }

  return messageDiv;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  // Kullanıcı mesajını ekle
  chatMessages.appendChild(createMessageElement(message, true));
  userInput.value = '';

  // AI'dan yanıt al
  try {
    const response = await window.electronAPI.sendMessageToGemini(message);
    chatMessages.appendChild(createMessageElement(response, false));
  } catch (error) {
    console.error('Hata:', error);
    chatMessages.appendChild(
      createMessageElement('İsteğiniz işlenirken bir hata oluştu.', false)
    );
  }

  // Aşağı kaydır
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});