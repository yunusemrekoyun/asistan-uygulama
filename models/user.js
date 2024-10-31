// models/user.js

const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(70),
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  faceDescriptor: {
    type: DataTypes.JSONB, // PostgreSQL için JSONB tipi
    allowNull: true,
  },
});

module.exports = User;