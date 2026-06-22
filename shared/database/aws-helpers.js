const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'ap-south-1';

// Clients initialization with catch blocks
let lambdaClient = null;
let snsClient = null;

try {
  lambdaClient = new LambdaClient({ region });
  console.log('[AWS Helpers] Lambda client initialized.');
} catch (err) {
  console.warn('[AWS Helpers] Failed to initialize Lambda client. Using local calculation fallbacks:', err.message);
}

try {
  snsClient = new SNSClient({ region });
  console.log('[AWS Helpers] SNS client initialized.');
} catch (err) {
  console.warn('[AWS Helpers] Failed to initialize SNS client. Using simulated log fallbacks:', err.message);
}

/**
 * Invokes a Lambda function with a payload. Falls back to local execution if disabled or offline.
 */
async function invokeLambda(functionName, payload, localFallbackFn) {
  if (lambdaClient && functionName && process.env.SKIP_LAMBDA !== 'true') {
    try {
      console.log(`[AWS Helpers] Invoking Lambda function: ${functionName}`);
      const response = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: functionName,
          Payload: Buffer.from(JSON.stringify(payload))
        })
      );
      const resultPayload = Buffer.from(response.Payload).toString();
      const result = JSON.parse(resultPayload);
      if (response.FunctionError) {
        throw new Error(`Lambda execution failed: ${result.errorMessage || 'Unknown error'}`);
      }
      console.log(`[AWS Helpers] Lambda ${functionName} success response:`, result);
      return result;
    } catch (err) {
      console.warn(`[AWS Helpers] Lambda invocation failed for ${functionName} (${err.message}). Running local fallback.`);
    }
  }

  // Fallback to local computation
  return localFallbackFn(payload);
}

/**
 * Publishes a message to an SNS topic. Falls back to console logging if offline.
 */
async function publishSNS(topicArn, message, subject) {
  if (snsClient && topicArn && process.env.SKIP_SNS !== 'true') {
    try {
      console.log(`[AWS Helpers] Publishing to SNS Topic: ${topicArn}`);
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: message,
          Subject: subject
        })
      );
      console.log(`[AWS Helpers] Successfully published to ${topicArn}`);
      return;
    } catch (err) {
      console.error(`[AWS Helpers] SNS publish failed for ${topicArn} (${err.message}).`);
    }
  }

  console.log(`[SIMULATED SNS ALERT] Topic: ${topicArn || 'LOCAL-SIMULATOR'}\nSubject: ${subject}\nMessage: ${message}\n-----------------------------`);
}

module.exports = {
  invokeLambda,
  publishSNS
};
