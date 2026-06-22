const { loadSecrets } = require('./secrets-manager');

async function runMigrations() {
  console.log('Starting database synchronization...');
  try {
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models to DB tables
    await sequelize.sync({ alter: true });
    console.log('Database tables successfully synchronized.');
    process.exit(0);
  } catch (error) {
    console.error('Unable to synchronize database:', error);
    process.exit(1);
  }
}

async function start() {
  await loadSecrets();
  await runMigrations();
}

if (require.main === module) {
  start();
}

module.exports = runMigrations;
