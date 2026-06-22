const { loadSecrets } = require('../../shared/database/secrets-manager');

loadSecrets().then(() => {
  const app = require('./app');
  const PORT = process.env.PORT || 3003;
  
  app.listen(PORT, () => {
    console.log(`[Meter Service] Running on port ${PORT}`);
    console.log(`[Meter Service] Swagger Docs available at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('[Meter Service] Initialization failed:', err);
  process.exit(1);
});
