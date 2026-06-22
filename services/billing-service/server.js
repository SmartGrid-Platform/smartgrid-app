const { loadSecrets } = require('../../shared/database/secrets-manager');

loadSecrets().then(() => {
  const app = require('./app');
  const PORT = process.env.PORT || 3004;
  
  app.listen(PORT, () => {
    console.log(`[Billing Service] Running on port ${PORT}`);
    console.log(`[Billing Service] Swagger Docs available at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('[Billing Service] Initialization failed:', err);
  process.exit(1);
});
