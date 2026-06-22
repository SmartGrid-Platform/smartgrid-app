const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let secretsLoaded = false;

async function loadSecrets() {
  if (secretsLoaded) {
    return;
  }

  const secretName = process.env.AWS_SECRET_NAME || 'smartgrid/config';
  const region = process.env.AWS_REGION || 'ap-south-1';

  if (process.env.SKIP_SECRETS_MANAGER === 'true' || process.env.SKIP_DB === 'true') {
    console.log('[Secrets Manager] Skipping AWS Secrets Manager (SKIP_SECRETS_MANAGER or SKIP_DB is set).');
    secretsLoaded = true;
    return;
  }

  try {
    const client = new SecretsManagerClient({ region });
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: 'AWSCURRENT'
      })
    );

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      for (const [key, value] of Object.entries(secrets)) {
        process.env[key] = value;
      }
      console.log(`[Secrets Manager] Successfully loaded secrets from Secret ID: ${secretName}`);
      secretsLoaded = true;
    } else {
      console.warn(`[Secrets Manager] Secret string was empty for Secret ID: ${secretName}`);
    }
  } catch (err) {
    console.warn(`[Secrets Manager] Could not load secrets from AWS (${err.message}). Using local environment fallback.`);
    secretsLoaded = true; // Set to true to prevent infinite retries, falling back to local .env
  }
}

module.exports = { loadSecrets };
