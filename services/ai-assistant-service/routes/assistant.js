const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createAgent } = require('../services/agent');
const bedrockProvider = require('../services/bedrockProvider');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');

const router = express.Router();

const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  storage: multer.memoryStorage()
});

// Health check endpoints (required by K8s liveness/readiness probes)
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'ai-assistant-service', timestamp: new Date() });
});

router.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'ai-assistant-service', timestamp: new Date() });
});

// Track sessions in memory for simple demonstration (in production use Redis/DB)
const userSessions = new Map();

router.post('/chat', authenticate, async (req, res) => {
  console.log('[CHAT] ==========================================');
  console.log('[CHAT] Received incoming chat request');
  const { message, sessionId } = req.body;
  const consumerId = req.user?.consumerId || null; 
  const authHeader = req.headers.authorization;
  
  if (!message) {
    console.warn('[CHAT] [WARN] Missing message payload in request body');
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!req.user || !req.user.id) {
    console.error('[CHAT] [ERROR] Unauthorized access: user payload is missing');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log(`[CHAT] [AUTH-CONTEXT] User Email: ${req.user.email} | User ID: ${req.user.id} | Role: ${req.user.role} | Consumer ID: ${consumerId}`);
  console.log(`[CHAT] [PAYLOAD] Message: "${message}" | Session ID Input: "${sessionId || 'None'}"`);

  const sId = sessionId || `session_${req.user.id}_${Date.now()}`;
  
  if (!userSessions.has(sId)) {
    console.log(`[CHAT] [SESSION] Creating new assistant session: ${sId}`);
    userSessions.set(sId, {
      configurable: { thread_id: sId },
      consumerId,
      authHeader,
      messages: []
    });
  } else {
    console.log(`[CHAT] [SESSION] Reusing existing assistant session: ${sId}`);
  }
  
  const config = userSessions.get(sId);
  config.consumerId = consumerId;
  config.authHeader = authHeader; // pass down for internal API calls
  
  // Initialize messages history if missing, push current message
  config.messages = config.messages || [];
  config.messages.push({ role: 'user', content: message });
  
  // Bound context size to prevent token bloat and ensure it always starts with a user message
  if (config.messages.length > 15) {
    config.messages = config.messages.slice(-15);
  }
  while (config.messages.length > 0 && config.messages[0].role !== 'user') {
    config.messages.shift();
  }
  
  try {
    console.log(`[CHAT] Initializing AI assistant agent for session ${sId}`);
    const agent = await createAgent();
    
    console.log(`[CHAT] Invoking agent with message history length: ${config.messages.length}`);
    const result = await agent.invoke({
      messages: config.messages,
      consumerId: config.consumerId,
      authHeader: config.authHeader,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        consumerId: consumerId,
        consumerNumber: req.user.consumerNumber || null
      }
    }, {
      configurable: {
        thread_id: sId
      }
    });

    const aiMessage = result.messages[result.messages.length - 1];
    console.log(`[CHAT] Agent response generated successfully`);
    
    // Save assistant reply to session history
    config.messages.push({ role: 'assistant', content: aiMessage.content });
    
    return res.status(200).json({
      reply: aiMessage.content,
      sessionId: sId
    });
  } catch (error) {
    console.error('[CHAT] AI Chat Error:', error.stack || error);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

router.post('/explain-bill', authenticate, async (req, res) => {
  console.log('[EXPLAIN] Received explain-bill request');
  const { billId } = req.body;
  const consumerId = req.user?.consumerId || null; 
  const authHeader = req.headers.authorization;

  if (!billId) {
    console.warn('[EXPLAIN] Missing billId');
    return res.status(400).json({ error: 'Bill ID is required' });
  }

  if (!req.user || !req.user.id) {
    console.error('[EXPLAIN] Unauthorized access');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log(`[EXPLAIN] Initializing agent to explain bill ${billId} for user ${req.user.id}`);
    const agent = await createAgent();
    
    const message = `Please explain my bill with ID ${billId}. Give a breakdown, compare it to past usage, and provide energy-saving recommendations based on my historical usage patterns.`;
    
    const result = await agent.invoke({
      messages: [{ role: 'user', content: message }],
      consumerId,
      authHeader,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        consumerId: consumerId,
        consumerNumber: req.user.consumerNumber || null
      }
    }, {
      configurable: {
        thread_id: `explain_${billId}_${Date.now()}`
      }
    });

    const aiMessage = result.messages[result.messages.length - 1];
    console.log('[EXPLAIN] Bill explanation generated successfully');
    
    return res.status(200).json({
      explanation: aiMessage.content
    });
  } catch (error) {
    console.error('[EXPLAIN] Explain Bill Error:', error.stack || error);
    return res.status(500).json({ error: 'Failed to generate bill explanation' });
  }
});

router.post('/upload-bill', authenticate, upload.single('billPdf'), async (req, res) => {
  console.log('[UPLOAD] Received bill upload request');
  const file = req.file;
  const sessionId = req.body.sessionId;
  const consumerId = req.user?.consumerId || null;
  const authHeader = req.headers.authorization;

  console.log("File received:", file?.originalname);
  console.log("File size:", file?.size);
  console.log("Buffer length:", file?.buffer?.length);

  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No PDF file uploaded or file buffer is empty' });
  }

  try {
    let extractedText = '';
    
    // 1. Try pdf-parse as primary method
    try {
      const data = await pdfParse(file.buffer);
      console.log("Pages:", data.numpages);
      console.log("Text Length:", data.text.length);
      extractedText = data.text.trim();
      console.log("Extracted text preview:", extractedText.substring(0, 500));
    } catch (parseErr) {
      console.warn('[UPLOAD] pdf-parse failed:', parseErr.message);
    }

    // 2. Fallback to Textract if pdf-parse text is too short (e.g. < 50 chars means likely scanned)
    if (extractedText.length < 50) {
      console.log('[UPLOAD] pdf-parse output insufficient. Falling back to Amazon Textract...');
      if (file.size > 5 * 1024 * 1024) {
         console.warn('[UPLOAD] File is larger than 5MB; synchronous Textract may fail.');
      }
      try {
        const command = new DetectDocumentTextCommand({
          Document: { Bytes: file.buffer }
        });
        const textractResponse = await textractClient.send(command);
        extractedText = textractResponse.Blocks
          .filter(block => block.BlockType === 'LINE')
          .map(block => block.Text)
          .join('\n');
        console.log(`[UPLOAD] Textract extracted ${extractedText.length} characters.`);
      } catch (textractErr) {
        console.error('[UPLOAD] Textract fallback failed:', textractErr.message);
        throw new Error('Failed to extract text from PDF using both primary and fallback methods. ' + textractErr.message);
      }
    }

    if (!extractedText || extractedText.length === 0) {
      return res.status(400).json({ error: 'PDF uploaded but no text could be extracted.' });
    }

    console.log("Sending extracted bill text to Bedrock");
    console.log(extractedText.substring(0, 1000));

    // 3. Inject context into the session
    const sId = sessionId || `session_${req.user.id}_${Date.now()}`;
    if (!userSessions.has(sId)) {
      userSessions.set(sId, {
        configurable: { thread_id: sId },
        consumerId,
        authHeader,
        messages: []
      });
    }
    const config = userSessions.get(sId);
    config.consumerId = consumerId;
    config.authHeader = authHeader;
    
    // Add context to messages history
    config.messages = config.messages || [];
    
    const analyzePrompt = `[Attached PDF Context]:\n${extractedText}\n\nPlease analyze this bill and provide a structured summary (Name, Period, Units, Amount, Due Date, Status) followed by 3 short bullet points of smart insights regarding usage or cost.`;
    
    config.messages.push({ role: 'user', content: analyzePrompt });

    // 4. Invoke agent
    console.log(`[UPLOAD] Invoking agent to analyze uploaded bill for session ${sId}`);
    try {
      const agent = await createAgent();
      const result = await agent.invoke({
        messages: config.messages,
        consumerId: config.consumerId,
        authHeader: config.authHeader,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          consumerId: consumerId,
          consumerNumber: req.user.consumerNumber || null
        }
      }, {
        configurable: { thread_id: sId }
      });

      const aiMessage = result.messages[result.messages.length - 1];
      config.messages.push({ role: 'assistant', content: aiMessage.content });

      return res.status(200).json({
        reply: aiMessage.content,
        sessionId: sId
      });
    } catch (bedrockError) {
      console.error("Bedrock Error:", bedrockError);
      return res.status(500).json({ error: 'Bedrock API call failed or permission denied while invoking Bedrock.' });
    }

  } catch (error) {
    console.error('[UPLOAD] Error processing PDF:', error.stack || error);
    return res.status(500).json({ error: error.message || 'Sorry, I encountered an error. Please try again later.' });
  }
});

router.get('/health', async (req, res) => {
  let bedrockStatus = 'unknown';
  try {
    // A lightweight ping or check
    if (bedrockProvider.primaryModel) {
       bedrockStatus = 'healthy';
    }
  } catch (err) {
    bedrockStatus = 'unhealthy';
  }

  res.status(200).json({
    service: "healthy",
    bedrock: bedrockStatus,
    billingService: process.env.BILLING_SERVICE_URL ? "configured" : "missing",
    meterService: process.env.METER_SERVICE_URL ? "configured" : "missing",
    consumerService: process.env.CONSUMER_SERVICE_URL ? "configured" : "missing"
  });
});

router.get('/debug', authenticate, async (req, res) => {
  try {
    const agent = await createAgent();
    
    res.status(200).json({
      jwtValid: true,
      consumerFound: !!req.user,
      billingConnected: !!process.env.BILLING_SERVICE_URL,
      meterConnected: !!process.env.METER_SERVICE_URL,
      bedrockConnected: !!bedrockProvider.primaryModel,
      graphInitialized: !!agent,
      modelPrimary: bedrockProvider.primaryModel,
      modelFallback: bedrockProvider.fallbackModel
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

module.exports = router;
