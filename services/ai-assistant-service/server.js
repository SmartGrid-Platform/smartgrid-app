const { loadSecrets } = require('../../shared/database/secrets-manager');

loadSecrets().then(() => {
  const app = require('./app');
  const PORT = process.env.PORT || 4004;

  app.listen(PORT, () => {
    console.log(`[AI Assistant Service] Running on port ${PORT}`);
  });
}).catch(err => {
  console.error('[AI Assistant Service] Initialization failed:', err);
  process.exit(1);
});
