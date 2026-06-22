const { loadSecrets } = require('../../shared/database/secrets-manager');

loadSecrets().then(() => {
  const app = require('./app');
  const PORT = process.env.PORT || 3005;
  
  app.listen(PORT, () => {
    console.log(`[Alert Service] Running on port ${PORT}`);
    console.log(`[Alert Service] Swagger Docs available at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('[Alert Service] Failed to initialize:', err);
  process.exit(1);
});
