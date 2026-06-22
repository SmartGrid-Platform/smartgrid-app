const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const assistantRoutes = require('./routes/assistant');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.get('/health',  (req, res) => res.status(200).json({ status: 'healthy', service: 'ai-assistant-service', timestamp: new Date() }));
app.get('/healthz', (req, res) => res.status(200).json({ status: 'healthy', service: 'ai-assistant-service', timestamp: new Date() }));
app.get('/ready',   (req, res) => res.status(200).json({ status: 'ready',   service: 'ai-assistant-service', timestamp: new Date() }));

app.use('/api/assistant', assistantRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
