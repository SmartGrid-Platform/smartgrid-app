const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const { Consumer, User, Meter, Bill, Recharge, Inspection, Notification, Tariff } = require('../../shared/database/models');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Custom Rate Limiter Middleware
const rateLimitMap = new Map();
const rateLimiter = (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/healthz' ||
    req.path === '/ready'
  ) {
    return next();
  }
  const ip = req.ip;
  const now = Date.now();
  const limit = 150; // 150 requests
  const windowMs = 15 * 60 * 1000;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip).filter(time => now - time < windowMs);
  requests.push(now);
  rateLimitMap.set(ip, requests);
  
  if (requests.length > limit) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  next();
};

app.use(rateLimiter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'consumer-service', timestamp: new Date() });
});
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'consumer-service', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'consumer-service', timestamp: new Date() });
});

// GET all consumers (Staff/Admin only)
app.get('/api/consumers', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const consumers = await Consumer.findAll({
      include: [
        { model: User, as: 'user', attributes: ['name', 'email', 'status'] },
        { model: Meter, as: 'meters' }
      ]
    });
    return res.status(200).json(consumers);
  } catch (error) {
    console.error('Fetch Consumers Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET current logged-in consumer profile details
app.get('/api/consumers/me', authenticate, authorize(['CONSUMER']), async (req, res) => {
  try {
    const consumer = await Consumer.findOne({
      where: { user_id: req.user.id },
      include: [
        { model: User, as: 'user', attributes: ['name', 'email', 'status'] },
        { model: Meter, as: 'meters' }
      ]
    });
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }
    return res.status(200).json(consumer);
  } catch (error) {
    console.error('Fetch Own Profile Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET consumer by ID (Staff/Supervisor/Admin or own self)
app.get('/api/consumers/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const consumer = await Consumer.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['name', 'email', 'status'] },
        { model: Meter, as: 'meters' }
      ]
    });

    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Auth verification: Consumer can only view their own profile
    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to access this profile' });
    }

    return res.status(200).json(consumer);
  } catch (error) {
    console.error('Fetch Consumer Details Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update consumer address/phone (Consumer themselves or Admin/Staff)
app.put('/api/consumers/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { address, phone } = req.body;

  try {
    const consumer = await Consumer.findByPk(id);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }

    // Verify self-update or staff/admin
    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to update this profile' });
    }

    if (address !== undefined) consumer.address = address;
    if (phone !== undefined) consumer.phone = phone;

    await consumer.save();
    return res.status(200).json({ message: 'Profile updated successfully', consumer });
  } catch (error) {
    console.error('Update Consumer Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT toggle connection status or update balance (Staff/Admin only)
app.put('/api/consumers/:id/status', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { connection_status, balance } = req.body;

  try {
    const consumer = await Consumer.findByPk(id);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    if (connection_status) consumer.connection_status = connection_status;
    if (balance !== undefined) consumer.balance = balance;

    await consumer.save();
    return res.status(200).json({ message: 'Consumer status updated successfully', consumer });
  } catch (error) {
    console.error('Update Consumer Status Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST assign meter to consumer (Staff/Admin only)
app.post('/api/consumers/assign-meter', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { consumerId, meterId } = req.body;

  if (!consumerId || !meterId) {
    return res.status(400).json({ error: 'Consumer ID and Meter ID are required' });
  }

  try {
    const consumer = await Consumer.findByPk(consumerId);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const meter = await Meter.findByPk(meterId);
    if (!meter) {
      return res.status(404).json({ error: 'Meter not found' });
    }

    meter.consumer_id = consumerId;
    await meter.save();

    return res.status(200).json({
      message: 'Meter assigned successfully',
      consumerId,
      meterId,
      tariffId: meter.tariff_id,
      meterNumber: meter.meter_number,
      installationDate: meter.installation_date
    });
  } catch (error) {
    console.error('Assign Meter Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// DELETE consumer profile and user account (Staff/Admin only)
app.delete('/api/consumers/:id', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const consumer = await Consumer.findByPk(id);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Unassign meters first
    await Meter.update({ consumer_id: null, installation_date: null }, { where: { consumer_id: id } });

    const userId = consumer.user_id;

    // Delete related child records first to avoid DB constraint failures
    await Bill.destroy({ where: { consumer_id: id } });
    await Recharge.destroy({ where: { consumer_id: id } });
    await Inspection.destroy({ where: { consumer_id: id } });
    if (userId) {
      await Notification.destroy({ where: { user_id: userId } });
    }

    await consumer.destroy();

    if (userId) {
      await User.destroy({ where: { id: userId } });
    }

    return res.status(200).json({ message: 'Consumer profile and user account deleted successfully' });
  } catch (error) {
    console.error('Delete Consumer Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
