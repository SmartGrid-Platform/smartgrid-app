const bedrockProvider = require('./bedrockProvider');
const { toolsList, executeTool } = require('./tools');
const { ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const SYSTEM_PROMPT = `You are SmartGrid AI Assistant, an enterprise-grade utility intelligence assistant.

You help consumers, staff, and administrators understand electricity usage, billing, tariffs, smart meters, utility operations, energy efficiency, renewable energy, and power systems.

When answering, strictly adhere to the following rules:
1. Use SmartGrid database information first by calling the appropriate dedicated tools:
   - Call "consumer_tool" to get profiles, names, connection statuses, or roles.
   - Call "meter_tool" to get smart meter details, serial numbers, current/previous reading values.
   - Call "billing_tool" to get invoice histories, current statement details, due amounts, and payment statuses.
   - Call "tariff_tool" to retrieve rates and fixed charges.
   - Call "consumption_tool" to perform usage analysis (current units used, monthly total, historical trends).
2. Call the "web_search" tool to perform web searches for general electricity questions, regulatory rules, solar net metering, and state tariffs (such as Andhra Pradesh, Telangana, Tamil Nadu, Karnataka) where platform data is absent.
3. EXPLAIN FAILURE DESCRIPTIVELY: If a tool execution fails or returns an error message (e.g. "Error: Failed to retrieve consumer profile" or "consumer-service returned 404"), DO NOT output a generic response like "Unable to retrieve data". Explain the actual failure clearly to the user, including the service code or reason.
4. TARIFF VALUE FIELD INTERPRETATION:
   - The "rate_per_unit" field represents the energy charge (in ₹ per kWh).
   - The "fixed_charge" field represents the flat monthly customer service fee.
   - NEVER confuse "rate_per_unit" with "fixed_charge". For example, if rate_per_unit is ₹0.15/kWh and fixed_charge is ₹20.00, clearly report:
     * Rate Per Unit: ₹0.15/kWh
     * Fixed Charge: ₹20.00
     Do not say the tariff rate is ₹20.00.
5. USER IDENTIFICATION:
   - Use the Active Logged-in User Context injected at the bottom of this prompt to immediately identify who the logged-in user is (name, email, role, consumerNumber, etc.) when asked "What user am I?" or similar identity questions.
6. CITATIONS:
   - When using web search data, cite your sources clearly. Format them with descriptive markdown links (e.g. "[Andhra Pradesh Tariff Order (APERC)](url)").
7. CRITICAL CURRENCY RULES:
   - All monetary values, costs, charges, and balances MUST be displayed in Indian Rupees (₹).
   - NEVER use US Dollars ($) or the USD symbol.
   - The currency code is INR.
   - Format numbers appropriately (e.g. ₹15,000 instead of $15,000).
8. Explain technical concepts in simple language.
9. Provide actionable energy recommendations and billing insights whenever useful.
10. Support detailed analytical conversations, follow-up questions, and utility operations topics.
11. UPLOADED BILL ANALYSIS: If the user conversation contains an "[Attached PDF Context]" block, prioritize using that extracted text to answer specific questions about that particular bill, its charges, and summary. Distinguish between their historical system data and the specific uploaded document.`;

const runConverseAgent = async (messages, consumerId, authHeader, user) => {
  const client = bedrockProvider.client;
  const modelId = bedrockProvider.primaryModel;
  const config = { consumerId, authHeader };

  // Append user context block dynamically to the system prompt
  let dynamicSystemPrompt = SYSTEM_PROMPT;
  if (user) {
    dynamicSystemPrompt += `\n\nActive Logged-in User Context:\n${JSON.stringify(user, null, 2)}`;
  }

  // 1. Format messages array for Bedrock Converse command
  const formattedMessages = messages.map(msg => {
    // If msg.content is an array (representing tool results or complex structure), pass it as is
    const content = typeof msg.content === 'string' 
      ? [{ text: msg.content }] 
      : msg.content;
    
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content
    };
  });

  console.log(`[AGENT] Starting Bedrock Converse loop for user ${consumerId || 'N/A'} (${user?.email || 'unknown'}). Message count: ${formattedMessages.length}`);

  // 2. Loop to handle model execution and tool calls (limit to 5 rounds)
  for (let round = 0; round < 5; round++) {
    const command = new ConverseCommand({
      modelId,
      messages: formattedMessages,
      system: [{ text: dynamicSystemPrompt }],
      toolConfig: { tools: toolsList },
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1
      }
    });

    console.log(`[AGENT] Invoking model ${modelId} (Round ${round + 1})...`);
    const response = await client.send(command);
    const outputMessage = response.output.message;
    
    // Save model output to the conversation history of this Converse session
    formattedMessages.push({
      role: outputMessage.role,
      content: outputMessage.content
    });

    // Check if the model wants to call tools
    const toolRequests = outputMessage.content.filter(part => part.toolUse);
    if (toolRequests.length === 0) {
      // No tool calls requested, we can return the text output
      const textPart = outputMessage.content.find(part => part.text);
      console.log('[AGENT] Converse loop complete. Text response generated.');
      return textPart ? textPart.text : 'I processed your request.';
    }

    // Process all requested tool calls
    console.log(`[AGENT] Model requested ${toolRequests.length} tool calls.`);
    const toolResults = [];

    for (const toolReq of toolRequests) {
      const { name, toolUseId, input } = toolReq.toolUse;
      try {
        const resultString = await executeTool(name, input, config);
        toolResults.push({
          toolResult: {
            toolUseId,
            content: [{ text: resultString }],
            status: "success"
          }
        });
      } catch (error) {
        console.error(`[AGENT] Tool execution error for "${name}":`, error.message);
        toolResults.push({
          toolResult: {
            toolUseId,
            content: [{ text: `Error: ${error.message}` }],
            status: "error"
          }
        });
      }
    }

    // Add tool results as the next user message to the Converse session
    formattedMessages.push({
      role: "user",
      content: toolResults
    });
  }

  throw new Error('Tool execution loop limit exceeded (max 5 rounds).');
};

const createAgent = () => {
  return {
    invoke: async ({ messages, consumerId, authHeader, user }) => {
      try {
        const reply = await runConverseAgent(messages, consumerId, authHeader, user);
        return {
          messages: [...messages, { role: 'assistant', content: reply }]
        };
      } catch (error) {
        console.error('[AGENT] Fatal agent invocation error:', error);
        throw error;
      }
    }
  };
};

module.exports = { createAgent };
