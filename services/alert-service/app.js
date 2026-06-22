const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const { sequelize, Op, Notification, Inspection, User, Consumer } = require('../../shared/database/models');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Custom Rate Limiter
const rateLimitMap = new Map();
app.use((req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/healthz' ||
    req.path === '/ready'
  ) {
    return next();
  }
  const ip = req.ip;
  const now = Date.now();
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const requests = rateLimitMap.get(ip).filter(t => now - t < 15 * 60 * 1000);
  requests.push(now);
  rateLimitMap.set(ip, requests);
  if (requests.length > 200) return res.status(429).json({ error: 'Too many requests' });
  next();
});

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Email dispatch helper
const dispatchEmail = async (toEmail, subject, text) => {
  // If SMTP credentials aren't configured, perform fallback centralized logging
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[SIMULATED EMAIL LOG] Dispatching message to: ${toEmail}\nSubject: ${subject}\nBody: ${text}\n-----------------------------`);
    return;
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL || '"SmartGrid Utility" <noreply@smartgrid.com>',
      to: toEmail,
      subject,
      text
    });
    console.log(`[SMTP] Email successfully dispatched to ${toEmail}`);
  } catch (error) {
    console.error(`[SMTP Error] Failed to send email to ${toEmail}:`, error.message);
  }
};

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'alert-service', timestamp: new Date() });
});
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'alert-service', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'alert-service', timestamp: new Date() });
});

// GET all notifications (Staff/Admin only)
app.get('/api/alerts', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const alerts = await Notification.findAll({
      where: {
        type: {
          [Op.in]: ['TAMPER', 'INSPECTION', 'SYSTEM']
        }
      },
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Fetch Alerts Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET notifications for specific user (User themselves or Staff/Supervisor/Admin)
app.get('/api/alerts/user/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  try {
    if (req.user.role === 'CONSUMER' && req.user.id !== parseInt(userId, 10)) {
      return res.status(403).json({ error: 'Unauthorized to access these alerts' });
    }

    const alerts = await Notification.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Fetch User Alerts Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST send notification (and trigger SMTP email)
app.post('/api/alerts', authenticate, async (req, res) => {
  const { user_id, title, message, type } = req.body;

  if (!user_id || !title || !message || !type) {
    return res.status(400).json({ error: 'User ID, title, message, and type are required' });
  }

  try {
    const targetUser = await User.findByPk(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const alert = await Notification.create({
      user_id,
      title,
      message,
      type
    });

    // Send email alert asynchronously in the background
    dispatchEmail(targetUser.email, `SmartGrid Alert: ${title}`, message);

    return res.status(201).json({ message: 'Alert recorded successfully', alert });
  } catch (error) {
    console.error('Create Alert Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all inspections (Staff/Admin only)
app.get('/api/inspections', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const inspections = await Inspection.findAll({
      include: [
        { model: Consumer, as: 'consumer', include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] },
        { model: User, as: 'assignedUser', attributes: ['name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(inspections);
  } catch (error) {
    console.error('Fetch Inspections Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create manual inspection (Staff/Admin only)
app.post('/api/inspections', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { consumer_id, reason, assigned_to } = req.body;

  if (!consumer_id || !reason) {
    return res.status(400).json({ error: 'Consumer ID and reason are required' });
  }

  try {
    const consumer = await Consumer.findByPk(consumer_id);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    if (assigned_to) {
      const staff = await User.findByPk(assigned_to);
      if (!staff || staff.role !== 'STAFF') {
        return res.status(400).json({ error: 'Inspection can only be assigned to Staff role' });
      }
    }

    const inspection = await Inspection.create({
      consumer_id,
      reason,
      assigned_to,
      status: 'PENDING'
    });

    return res.status(201).json({ message: 'Inspection created successfully', inspection });
  } catch (error) {
    console.error('Create Inspection Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update inspection assignment or status (Staff/Admin only)
app.put('/api/inspections/:id', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to } = req.body;

  try {
    const inspection = await Inspection.findByPk(id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (status) {
      if (!['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid inspection status' });
      }
      inspection.status = status;
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        inspection.assigned_to = null;
      } else {
        const staff = await User.findByPk(assigned_to);
        if (!staff || staff.role !== 'STAFF') {
          return res.status(400).json({ error: 'Inspection can only be assigned to Staff role' });
        }
        inspection.assigned_to = assigned_to;
      }
    }

    await inspection.save();
    return res.status(200).json({ message: 'Inspection updated successfully', inspection });
  } catch (error) {
    console.error('Update Inspection Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
