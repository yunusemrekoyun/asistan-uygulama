// models/index.js

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('asistan_user', 'postgres', '4316', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;

