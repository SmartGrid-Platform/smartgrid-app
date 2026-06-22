const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const { sequelize, Meter, MeterReading, Consumer, Tariff, Notification, Inspection, User } = require('../../shared/database/models');
const { authenticate, authorize } = require('./middleware/auth');
const { invokeLambda, publishSNS } = require('../../shared/database/aws-helpers');

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

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'meter-service', timestamp: new Date() });
});
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'meter-service', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'meter-service', timestamp: new Date() });
});

// GET all meters (Staff/Admin only)
app.get('/api/meters', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const meters = await Meter.findAll({
      include: [{ model: Consumer, as: 'consumer', include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] }]
    });
    return res.status(200).json(meters);
  } catch (error) {
    console.error('Fetch Meters Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET meters for a specific consumer (Staff/Supervisor/Admin or own self)
app.get('/api/meters/consumer/:consumerId', authenticate, async (req, res) => {
  const { consumerId } = req.params;
  try {
    const consumer = await Consumer.findByPk(consumerId);
    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Verify ownership
    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view these meters' });
    }

    const meters = await Meter.findAll({
      where: { consumer_id: consumerId },
      include: [{ model: Tariff, as: 'tariff' }]
    });
    return res.status(200).json(meters);
  } catch (error) {
    console.error('Fetch Consumer Meters Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET specific meter details
app.get('/api/meters/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const meter = await Meter.findByPk(id, {
      include: [
        { model: Consumer, as: 'consumer' },
        { model: Tariff, as: 'tariff' }
      ]
    });

    if (!meter) {
      return res.status(404).json({ error: 'Meter not found' });
    }

    if (req.user.role === 'CONSUMER' && (!meter.consumer || meter.consumer.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized to view this meter' });
    }

    return res.status(200).json(meter);
  } catch (error) {
    console.error('Fetch Meter Details Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a new meter (Staff/Admin only)
app.post('/api/meters', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { meter_number, meter_type, installation_date, status, tariff_id } = req.body;

  if (!meter_number) {
    return res.status(400).json({ error: 'Meter number is required' });
  }

  try {
    const existing = await Meter.findOne({ where: { meter_number } });
    if (existing) {
      return res.status(400).json({ error: 'Meter number already exists' });
    }

    if (tariff_id) {
      const tariff = await Tariff.findByPk(tariff_id);
      if (!tariff) {
        return res.status(400).json({ error: 'Selected tariff plan does not exist' });
      }
    }

    const meter = await Meter.create({
      meter_number,
      meter_type: meter_type || 'SMART',
      installation_date: installation_date || new Date().toISOString().split('T')[0],
      status: status || 'ACTIVE',
      tariff_id: tariff_id || null
    });

    return res.status(201).json({ message: 'Meter created successfully', meter });
  } catch (error) {
    console.error('Create Meter Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update meter status (e.g. report TAMPERED or set INACTIVE)
// Allowed for Staff and Admin
app.put('/api/meters/:id', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'INACTIVE', 'TAMPERED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const transaction = await sequelize.transaction();
  try {
    const meter = await Meter.findByPk(id, {
      include: [{ model: Consumer, as: 'consumer' }],
      transaction
    });

    if (!meter) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Meter not found' });
    }

    meter.status = status;
    await meter.save({ transaction });

    // If tampered and is assigned to a consumer, automatically trigger an alert and schedule inspection
    if (status === 'TAMPERED' && meter.consumer) {
      // Create notification
      await Notification.create({
        user_id: meter.consumer.user_id,
        title: 'Security Alert: Meter Tampered',
        message: `A tamper event has been detected on your meter (${meter.meter_number}). An inspection has been scheduled.`,
        type: 'TAMPER'
      }, { transaction });

      // Create inspection
      await Inspection.create({
        consumer_id: meter.consumer.id,
        reason: `Automated alert: Meter ${meter.meter_number} status updated to TAMPERED.`,
        status: 'PENDING'
      }, { transaction });
    }

    await transaction.commit();
    return res.status(200).json({ message: 'Meter updated successfully', meter });
  } catch (error) {
    await transaction.rollback();
    console.error('Update Meter Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all readings for a specific meter
app.get('/api/meters/:id/readings', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const meter = await Meter.findByPk(id, { include: [{ model: Consumer, as: 'consumer' }] });
    if (!meter) {
      return res.status(404).json({ error: 'Meter not found' });
    }

    if (req.user.role === 'CONSUMER' && (!meter.consumer || meter.consumer.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized to view these readings' });
    }

    const readings = await MeterReading.findAll({
      where: { meter_id: id },
      order: [['reading_date', 'DESC']]
    });

    return res.status(200).json(readings);
  } catch (error) {
    console.error('Fetch Readings Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST add reading, calculate cost, deduct balance, verify status/alerts (Staff/Admin/Meters)
app.post('/api/meters/:id/readings', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { units_consumed } = req.body;

  if (units_consumed === undefined || parseFloat(units_consumed) <= 0) {
    return res.status(400).json({ error: 'Units consumed must be a positive number' });
  }

  const transaction = await sequelize.transaction();
  try {
    const meter = await Meter.findByPk(id, {
      include: [{ model: Consumer, as: 'consumer' }],
      transaction
    });

    if (!meter) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Meter not found' });
    }

    if (meter.status === 'INACTIVE') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot add readings to an inactive meter' });
    }

    if (!meter.consumer_id) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Meter is not assigned to any consumer' });
    }

    // Invoke unit_calculator Lambda to process unit consumption input
    const unitResult = await invokeLambda(
      process.env.LAMBDA_UNIT_CALCULATOR,
      { current_reading: parseFloat(units_consumed), previous_reading: 0 },
      (payload) => ({ units_consumed: payload.current_reading })
    );
    const calculatedUnits = unitResult.units_consumed;

    // 1. Fetch Tariff assigned to this meter
    let tariff = null;
    if (meter.tariff_id) {
      tariff = await Tariff.findByPk(meter.tariff_id, { transaction });
    }
    
    if (!tariff) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active tariff plan is assigned to this meter.' });
    }
    
    const tariffResult = await invokeLambda(
      process.env.LAMBDA_TARIFF_ENGINE,
      { 
        tariff_name: tariff.tariff_name,
        rate_per_unit: parseFloat(tariff.rate_per_unit),
        fixed_charge: parseFloat(tariff.fixed_charge || 0)
      },
      (payload) => ({ rate_per_unit: parseFloat(tariff.rate_per_unit) })
    );
    const rate = tariffResult.rate_per_unit !== undefined ? tariffResult.rate_per_unit : parseFloat(tariff.rate_per_unit);

    // 2. Calculate Cost via bill_generator Lambda
    const billResult = await invokeLambda(
      process.env.LAMBDA_BILL_GENERATOR,
      { units: calculatedUnits, rate },
      (payload) => ({ amount: parseFloat(payload.units) * parseFloat(payload.rate) })
    );
    const cost = billResult.amount;

    // 3. Deduct from Consumer Balance
    const consumer = await Consumer.findByPk(meter.consumer_id, { transaction });
    if (!consumer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Consumer profile not found for this meter' });
    }
    const oldBalance = parseFloat(consumer.balance);
    const newBalance = oldBalance - cost;
    
    consumer.balance = newBalance;

    // 4. Update status and trigger alerts/disconnect (and publish to SNS)
    let statusMessage = 'Reading saved and balance deducted.';
    
    if (newBalance <= 0) {
      consumer.connection_status = 'DISCONNECTED';
      statusMessage = 'Reading saved. Service has been DISCONNECTED due to insufficient balance.';
      
      // Create disconnection notification in DB
      await Notification.create({
        user_id: consumer.user_id,
        title: 'Service Disconnected',
        message: `Your utility service was suspended because your balance dropped to ₹${newBalance.toFixed(2)}. Please recharge immediately to restore service.`,
        type: 'LOW_BALANCE'
      }, { transaction });

      // Publish to SNS Disconnection Notice
      const snsMsg = `
========================================
SMARTGRID SERVICE SUSPENSION NOTICE
========================================
Consumer Number: ${consumer.consumer_number}
Current Balance: ₹${newBalance.toFixed(2)}
Status: DISCONNECTED (Insufficient Funds)

Warning: Your electricity service has been suspended. Please complete a balance recharge immediately to restore power connection.
========================================
`.trim();
      await publishSNS(process.env.SNS_DISCONNECTION_ARN, snsMsg, 'Service Disconnected Alert');
    } else if (newBalance <= 15.00 && oldBalance > 15.00) {
      // Low balance warning triggered in DB
      await Notification.create({
        user_id: consumer.user_id,
        title: 'Low Balance Alert',
        message: `Your balance is running low. Current balance: ₹${newBalance.toFixed(2)}. Please recharge soon to avoid disconnection.`,
        type: 'LOW_BALANCE'
      }, { transaction });

      // Publish to SNS Low Balance Topic
      const snsMsg = `
========================================
SMARTGRID PREPAID BALANCE ALERT
========================================
Consumer Number: ${consumer.consumer_number}
Current Balance: ₹${newBalance.toFixed(2)}
Status: LOW BALANCE WARNING

Notice: Your balance is running low. Please recharge soon to avoid automatic disconnection of your electricity service.
========================================
`.trim();
      await publishSNS(process.env.SNS_LOW_BALANCE_ARN, snsMsg, 'Low Balance Alert');
    }

    await consumer.save({ transaction });

    // 5. Store Meter Reading
    const reading = await MeterReading.create({
      meter_id: id,
      units_consumed: calculatedUnits,
      reading_date: new Date()
    }, { transaction });

    await transaction.commit();
    return res.status(201).json({
      message: statusMessage,
      reading,
      units: calculatedUnits,
      rate,
      cost,
      oldBalance,
      newBalance,
      connectionStatus: consumer.connection_status
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Submit Reading Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE meter (Staff/Admin only)
app.delete('/api/meters/:id', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const meter = await Meter.findByPk(id);
    if (!meter) {
      return res.status(404).json({ error: 'Meter not found' });
    }
    
    // Delete meter readings first to avoid constraint violation
    await MeterReading.destroy({ where: { meter_id: id } });
    
    await meter.destroy();
    return res.status(200).json({ message: 'Meter and its reading history deleted successfully' });
  } catch (error) {
    console.error('Delete Meter Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
