// edit-person.js

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('edit-person-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const cancelButton = document.getElementById('cancel-button');

  // 'person-data' olayını dinle
  window.electronAPI.onPersonData((event, person) => {
    nameInput.value = person.name;
    emailInput.value = person.email;
    form.dataset.personId = person.id;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const updatedPerson = {
      id: parseInt(form.dataset.personId),
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
    };
    // 'person-updated' olayını gönder
    window.electronAPI.sendPersonUpdated(updatedPerson);
  });

  // İptal butonuna tıklandığında pencereyi kapat
  cancelButton.addEventListener('click', () => {
    window.close();
  });

  // 'Esc' tuşuna basıldığında pencereyi kapat
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.close();
    }
  });
});