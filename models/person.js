// models/person.js

const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Person = sequelize.define('Person', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(70),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(70),
    allowNull: false,
    unique: true,
  },
});

module.exports = Person;