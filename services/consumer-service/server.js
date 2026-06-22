const { loadSecrets } = require('../../shared/database/secrets-manager');

loadSecrets().then(() => {
  const app = require('./app');
  const PORT = process.env.PORT || 3002;
  
  app.listen(PORT, () => {
    console.log(`[Consumer Service] Running on port ${PORT}`);
    console.log(`[Consumer Service] Swagger Docs available at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('[Consumer Service] Initialization failed:', err);
  process.exit(1);
});
