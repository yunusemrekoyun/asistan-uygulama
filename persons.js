// persons.js

async function loadPersons() {
  const persons = await window.electronAPI.getPersons();
  const tableBody = document.querySelector('#persons-table tbody');
  tableBody.innerHTML = '';
  persons.forEach((person) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${person.id}</td>
      <td>${person.name}</td>
      <td>${person.email}</td>
      <td>
        <button class="edit-button" data-id="${person.id}">Düzenle</button>
        <button class="delete-button" data-id="${person.id}">Sil</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

document.getElementById('add-person-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  await window.electronAPI.addPerson({ name, email });
  await loadPersons();

  e.target.reset();
});

document.querySelector('#persons-table tbody').addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-button')) {
    const personId = e.target.getAttribute('data-id');
    await window.electronAPI.deletePerson(personId);
    await loadPersons();
  } else if (e.target.classList.contains('edit-button')) {
    const personId = e.target.getAttribute('data-id');
    const person = (await window.electronAPI.getPersons()).find((p) => p.id == personId);
    window.electronAPI.openEditPersonWindow(person);
  }
});

window.electronAPI.onPersonUpdated(() => {
  loadPersons();
});

window.addEventListener('DOMContentLoaded', () => {
  loadPersons();
});