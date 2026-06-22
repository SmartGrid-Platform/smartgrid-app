const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

class BedrockProvider {
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1'
    });
    const defaultPrimary = 'amazon.nova-pro-v1:0';
    const defaultFallback = 'amazon.nova-lite-v1:0';
    
    // Normalize us.amazon prefix to amazon for standard model IDs
    let pModel = process.env.BEDROCK_MODEL_PRIMARY || defaultPrimary;
    let fModel = process.env.BEDROCK_MODEL_FALLBACK || defaultFallback;
    
    this.primaryModel = pModel.includes('nova') ? pModel.replace('us.amazon.', 'amazon.') : pModel;
    this.fallbackModel = fModel.includes('nova') ? fModel.replace('us.amazon.', 'amazon.') : fModel;
  }

  async generateResponse(systemPrompt, userMessage) {
    return this._invokeWithFallback(systemPrompt, userMessage);
  }

  async generateBillExplanation(systemPrompt, billData) {
    const userMessage = `Explain this bill:\n${JSON.stringify(billData, null, 2)}`;
    return this._invokeWithFallback(systemPrompt, userMessage);
  }

  async generateEnergyRecommendations(systemPrompt, usageData) {
    const userMessage = `Analyze this usage and provide recommendations:\n${JSON.stringify(usageData, null, 2)}`;
    return this._invokeWithFallback(systemPrompt, userMessage);
  }

  async _invokeWithFallback(systemPrompt, userMessage) {
    try {
      return await this._invokeModel(this.primaryModel, systemPrompt, userMessage);
    } catch (error) {
      console.warn(`Primary model (${this.primaryModel}) failed. Falling back to ${this.fallbackModel}. Error:`, error.message);
      try {
        return await this._invokeModel(this.fallbackModel, systemPrompt, userMessage);
      } catch (fallbackError) {
        console.error(`Fallback model (${this.fallbackModel}) also failed. Error:`, fallbackError.message);
        throw new Error('Failed to generate response from Bedrock.');
      }
    }
  }

  async _invokeModel(modelId, systemPrompt, userMessage) {
    const command = new ConverseCommand({
      modelId: modelId,
      messages: [
        {
          role: "user",
          content: [{ text: userMessage }]
        }
      ],
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1
      }
    });

    const response = await this.client.send(command);
    if (response.output && response.output.message && response.output.message.content) {
       return response.output.message.content[0].text;
    }
    throw new Error('Unexpected response format from Bedrock');
  }
}

module.exports = new BedrockProvider();
