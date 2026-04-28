// fallback-store.js

const fs = require('fs');
const path = require('path');

const DEFAULT_DATA = {
  users: [],
  persons: [],
  meta: {
    userIdSeq: 1,
    personIdSeq: 1,
  },
};

class FallbackStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
  }

  async load() {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      await this.persist();
    }
  }

  ensureLoaded() {
    if (!this.data) {
      throw new Error('Fallback store not initialized.');
    }
  }

  async persist() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async findUserByUsername(username) {
    this.ensureLoaded();
    return this.data.users.find((user) => user.username === username) || null;
  }

  async createUser(userData) {
    this.ensureLoaded();
    const newUser = {
      id: this.data.meta.userIdSeq++,
      username: userData.username,
      passwordHash: userData.passwordHash,
      faceDescriptor: userData.faceDescriptor || null,
    };
    this.data.users.push(newUser);
    await this.persist();
    return newUser;
  }

  async listPersons() {
    this.ensureLoaded();
    return this.data.persons.slice();
  }

  async createPerson(personData) {
    this.ensureLoaded();
    if (personData.email) {
      const exists = this.data.persons.some((p) => p.email === personData.email);
      if (exists) {
        throw new Error('E-posta zaten kayıtlı.');
      }
    }
    const newPerson = {
      id: this.data.meta.personIdSeq++,
      name: personData.name,
      email: personData.email,
    };
    this.data.persons.push(newPerson);
    await this.persist();
    return newPerson;
  }

  async updatePerson(personId, updateData) {
    this.ensureLoaded();
    const person = this.data.persons.find((p) => p.id === personId);
    if (!person) {
      return false;
    }
    if (updateData.email && updateData.email !== person.email) {
      const exists = this.data.persons.some((p) => p.email === updateData.email);
      if (exists) {
        throw new Error('E-posta zaten kayıtlı.');
      }
    }
    Object.assign(person, updateData);
    await this.persist();
    return true;
  }

  async deletePerson(personId) {
    this.ensureLoaded();
    const before = this.data.persons.length;
    this.data.persons = this.data.persons.filter((p) => p.id !== personId);
    const changed = this.data.persons.length !== before;
    if (changed) {
      await this.persist();
    }
    return changed;
  }
}

module.exports = FallbackStore;
