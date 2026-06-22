const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const { sequelize, Consumer, User, Meter, MeterReading, Tariff, Recharge, Bill, Notification } = require('../../shared/database/models');
const { authenticate, authorize } = require('./middleware/auth');
const { Op } = require('sequelize');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// S3 helper for invoice management (with local fallback)
const { uploadBill, downloadBill } = require('../../shared/database/s3-helper');
const { invokeLambda } = require('../../shared/database/aws-helpers');

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

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'billing-service', timestamp: new Date() });
});
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'billing-service', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'billing-service', timestamp: new Date() });
});

// GET all tariffs
app.get('/api/tariffs', authenticate, async (req, res) => {
  try {
    const tariffs = await Tariff.findAll({ order: [['effective_date', 'DESC'], ['id', 'DESC']] });
    return res.status(200).json(tariffs);
  } catch (error) {
    console.error('Fetch Tariffs Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create tariff (Admin only)
app.post('/api/tariffs', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { tariff_name, tariff_type, rate_per_unit, fixed_charge, status, description, effective_date } = req.body;

  if (!tariff_name || rate_per_unit === undefined || !effective_date) {
    return res.status(400).json({ error: 'Tariff name, rate, and effective date are required' });
  }

  try {
    const tariff = await Tariff.create({
      tariff_name,
      tariff_type: tariff_type || 'Residential',
      rate_per_unit,
      fixed_charge: fixed_charge !== undefined ? fixed_charge : 0.00,
      status: status || 'ACTIVE',
      description,
      effective_date
    });
    return res.status(201).json({ message: 'Tariff created successfully', tariff });
  } catch (error) {
    console.error('Create Tariff Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// PUT update tariff (Admin only)
app.put('/api/tariffs/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { tariff_name, tariff_type, rate_per_unit, fixed_charge, status, description, effective_date } = req.body;

  try {
    const tariff = await Tariff.findByPk(id);
    if (!tariff) {
      return res.status(404).json({ error: 'Tariff plan not found' });
    }

    if (tariff_name !== undefined) tariff.tariff_name = tariff_name;
    if (tariff_type !== undefined) tariff.tariff_type = tariff_type;
    if (rate_per_unit !== undefined) tariff.rate_per_unit = rate_per_unit;
    if (fixed_charge !== undefined) tariff.fixed_charge = fixed_charge;
    if (status !== undefined) tariff.status = status;
    if (description !== undefined) tariff.description = description;
    if (effective_date !== undefined) tariff.effective_date = effective_date;

    await tariff.save();
    return res.status(200).json({ message: 'Tariff updated successfully', tariff });
  } catch (error) {
    console.error('Update Tariff Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// DELETE tariff (Admin only)
app.delete('/api/tariffs/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const tariff = await Tariff.findByPk(id);
    if (!tariff) {
      return res.status(404).json({ error: 'Tariff plan not found' });
    }

    // Validation: Cannot delete tariff currently assigned to active meters.
    const activeMetersCount = await Meter.count({
      where: {
        tariff_id: id,
        status: 'ACTIVE'
      }
    });

    if (activeMetersCount > 0) {
      return res.status(400).json({ error: 'Cannot delete tariff currently assigned to active meters.' });
    }

    // Set associated inactive/tampered meters tariff_id to null to prevent DB constraint errors
    await Meter.update({ tariff_id: null }, { where: { tariff_id: id } });

    await tariff.destroy();
    return res.status(200).json({ message: 'Tariff plan deleted successfully' });
  } catch (error) {
    console.error('Delete Tariff Error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// GET all recharges (Staff/Admin only)
app.get('/api/recharges', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const recharges = await Recharge.findAll({
      include: [{ model: Consumer, as: 'consumer', include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] }],
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(recharges);
  } catch (error) {
    console.error('Fetch Recharges Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET recharges for specific consumer (Staff/Supervisor/Admin or self)
app.get('/api/recharges/consumer/:consumerId', authenticate, async (req, res) => {
  const { consumerId } = req.params;
  try {
    const consumer = await Consumer.findByPk(consumerId);
    if (!consumer) return res.status(404).json({ error: 'Consumer not found' });

    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to access these records' });
    }

    const recharges = await Recharge.findAll({
      where: { consumer_id: consumerId },
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(recharges);
  } catch (error) {
    console.error('Fetch Consumer Recharges Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST process recharge (Consumer themselves or Staff/Admin)
app.post('/api/recharges', authenticate, async (req, res) => {
  const { consumer_id, amount } = req.body;

  if (amount === undefined || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Recharge amount must be a positive number' });
  }

  const transaction = await sequelize.transaction();
  try {
    const consumer = await Consumer.findByPk(consumer_id, { transaction });
    if (!consumer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Auth verification: Consumers can only recharge their own account
    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const currentBalance = parseFloat(consumer.balance);
    const newBalance = currentBalance + parseFloat(amount);
    
    // Save previous status to check if service reconnected
    const oldStatus = consumer.connection_status;

    consumer.balance = newBalance;
    
    // Automatic reconnection if balance restored above ₹0
    if (newBalance > 0 && oldStatus === 'DISCONNECTED') {
      consumer.connection_status = 'CONNECTED';
    }

    await consumer.save({ transaction });

    // Store Recharge history record
    const recharge = await Recharge.create({
      consumer_id,
      amount,
      balance_added: amount
    }, { transaction });

    // Create Notification alert
    await Notification.create({
      user_id: consumer.user_id,
      title: 'Recharge Successful',
      message: `Your account has been recharged with ₹${parseFloat(amount).toFixed(2)}. Current Balance: ₹${newBalance.toFixed(2)}. Status: ${consumer.connection_status}.`,
      type: 'RECHARGE'
    }, { transaction });

    await transaction.commit();
    return res.status(201).json({
      message: `Recharge of ₹${parseFloat(amount).toFixed(2)} completed successfully.`,
      recharge,
      newBalance,
      connectionStatus: consumer.connection_status
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Recharge Processing Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all bills (Staff/Admin only)
app.get('/api/bills', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const bills = await Bill.findAll({
      include: [{ model: Consumer, as: 'consumer', include: [{ model: User, as: 'user', attributes: ['name', 'email'] }] }],
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(bills);
  } catch (error) {
    console.error('Fetch Bills Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET billing history for specific consumer
app.get('/api/bills/consumer/:consumerId', authenticate, async (req, res) => {
  const { consumerId } = req.params;
  try {
    const consumer = await Consumer.findByPk(consumerId);
    if (!consumer) return res.status(404).json({ error: 'Consumer not found' });

    if (req.user.role === 'CONSUMER' && consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const bills = await Bill.findAll({
      where: { consumer_id: consumerId },
      order: [['created_at', 'DESC']]
    });

    console.log(`[DEBUG Dashboard API] Logged In User ID: ${req.user.id}, Consumer ID: ${consumerId}, Bills Retrieved: ${JSON.stringify(bills.map(b => b.id))}, Bills Count: ${bills.length}`);

    return res.status(200).json(bills);
  } catch (error) {
    console.error('Fetch Consumer Bills Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST generate monthly bill for consumer (Staff/Admin only)
app.post('/api/bills/generate', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { consumerId, billingMonth } = req.body; // billingMonth in YYYY-MM format

  if (!consumerId || !billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return res.status(400).json({ error: 'Consumer ID and billing month (YYYY-MM) are required' });
  }

  const transaction = await sequelize.transaction();
  try {
    const consumer = await Consumer.findByPk(consumerId, {
      include: [{ model: User, as: 'user' }],
      transaction
    });

    if (!consumer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Check if bill already generated for this month
    const existing = await Bill.findOne({
      where: { consumer_id: consumerId, billing_month: billingMonth },
      transaction
    });
    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ error: `Bill has already been generated for consumer in ${billingMonth}` });
    }

    // 1. Gather all consumer meters
    const meters = await Meter.findAll({
      where: { consumer_id: consumerId },
      transaction
    });

    if (meters.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Consumer does not have any meters assigned' });
    }

    // 2. Fetch all readings for these meters during that billingMonth
    const meterIds = meters.map(m => m.id);
    const year = parseInt(billingMonth.substring(0, 4), 10);
    const month = parseInt(billingMonth.substring(5, 7), 10);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const readings = await MeterReading.findAll({
      where: {
        meter_id: { [Op.in]: meterIds },
        reading_date: {
          [Op.gte]: startDate,
          [Op.lt]: endDate
        }
      },
      transaction
    });

    const totalUnits = readings.reduce((sum, r) => sum + parseFloat(r.units_consumed), 0);

    // 3. Find active tariff for the consumer's meter
    let tariff = null;
    const meterWithTariff = meters.find(m => m.tariff_id);
    if (meterWithTariff) {
      tariff = await Tariff.findByPk(meterWithTariff.tariff_id, { transaction });
    }

    if (!tariff) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No active tariff plan is assigned to this consumer\'s meter.' });
    }
    
    // Calculate previous reading & current reading
    const previousReadings = await MeterReading.findAll({
      where: {
        meter_id: { [Op.in]: meterIds },
        reading_date: { [Op.lt]: startDate }
      },
      transaction
    });
    const previousReading = previousReadings.reduce((sum, r) => sum + parseFloat(r.units_consumed), 0);
    const currentReading = previousReading + totalUnits;

    const tariffResult = await invokeLambda(
      process.env.LAMBDA_TARIFF_ENGINE,
      { 
        tariff_name: tariff.tariff_name,
        rate_per_unit: parseFloat(tariff.rate_per_unit),
        fixed_charge: parseFloat(tariff.fixed_charge || 0)
      },
      (payload) => ({ rate_per_unit: parseFloat(tariff.rate_per_unit), fixed_charge: parseFloat(tariff.fixed_charge || 0) })
    );
    const rate = tariffResult.rate_per_unit !== undefined ? tariffResult.rate_per_unit : parseFloat(tariff.rate_per_unit);
    const fixedCharge = tariffResult.fixed_charge !== undefined ? tariffResult.fixed_charge : parseFloat(tariff.fixed_charge || 0);

    // 4. Calculate total bill amount & generate PDF via bill_generator Lambda
    const lambdaPayload = {
      units: totalUnits,
      rate,
      fixedCharge,
      consumerNumber: consumer.consumer_number,
      billingMonth,
      consumerName: consumer.user.name,
      consumerEmail: consumer.user.email,
      consumerPhone: consumer.phone,
      consumerAddress: consumer.address,
      meterNumber: meterWithTariff.meter_number,
      tariffPlan: tariff.tariff_name,
      previousReading,
      currentReading,
      tax: 0.00,
      paymentStatus: 'PAID'
    };

    const billResult = await invokeLambda(
      process.env.LAMBDA_BILL_GENERATOR,
      lambdaPayload,
      async (payload) => {
        const amount = parseFloat(payload.units) * parseFloat(payload.rate) + parseFloat(payload.fixedCharge || 0);
        const fileName = `bill_${payload.consumerNumber}_${payload.billingMonth}.pdf`;
        
        return new Promise((resolve, reject) => {
          try {
            const PDFDocument = require('pdfkit');
            const fs = require('fs');
            const path = require('path');
            
            const billsDir = path.join(__dirname, '../../storage/bills');
            if (!fs.existsSync(billsDir)) {
              fs.mkdirSync(billsDir, { recursive: true });
            }
            const filePath = path.join(billsDir, fileName);
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = fs.createWriteStream(filePath);
            
            stream.on('finish', () => {
              console.log(`[Local Fallback] Successfully generated local PDF bill: ${filePath}`);
              resolve({
                amount,
                s3_key: fileName
              });
            });

            stream.on('error', (err) => {
              console.error('[Local Fallback] WriteStream Error:', err);
              reject(err);
            });

            doc.pipe(stream);
            
            // Header Banner
            doc.rect(0, 0, 595, 100).fill('#0D253F');
            doc.fillColor('#FFFFFF');
            doc.fontSize(22).font('Helvetica-Bold').text('SMARTGRID', 50, 30);
            doc.fontSize(10).font('Helvetica').text('Utility Management Platform', 50, 60);
            doc.fontSize(10).text('Date Generated: ' + new Date().toLocaleDateString(), 400, 45, { align: 'right', width: 145 });
            
            // Invoice Details Separator
            doc.fillColor('#0D253F').fontSize(14).font('Helvetica-Bold').text('BILLING STATEMENT', 50, 125);
            doc.strokeColor('#26C6DA').lineWidth(1.5).moveTo(50, 143).lineTo(545, 143).stroke();
            
            // Consumer Details & Billing Summary (2 columns)
            doc.fillColor('#333333').fontSize(9).font('Helvetica');
            // Left Col: Consumer Details
            doc.font('Helvetica-Bold').text('Consumer Details:', 50, 160);
            doc.font('Helvetica').text(`Name: ${payload.consumerName}`, 50, 180)
               .text(`Email: ${payload.consumerEmail}`, 50, 195)
               .text(`Phone: ${payload.consumerPhone}`, 50, 210)
               .text(`Address: ${payload.consumerAddress}`, 50, 225, { width: 220 });

            // Right Col: Billing info
            doc.font('Helvetica-Bold').text('Billing Summary:', 320, 160);
            doc.font('Helvetica').text(`Consumer Number: ${payload.consumerNumber}`, 320, 180)
               .text(`Meter Number: ${payload.meterNumber}`, 320, 195)
               .text(`Tariff Plan: ${payload.tariffPlan}`, 320, 210)
               .text(`Billing Month: ${payload.billingMonth}`, 320, 225);

            // Usage Table Section
            doc.fillColor('#0D253F').fontSize(11).font('Helvetica-Bold').text('Usage Details', 50, 275);
            doc.strokeColor('#E0E0E0').lineWidth(1).moveTo(50, 290).lineTo(545, 290).stroke();
            
            // Table Header Row
            doc.fillColor('#555555').fontSize(8.5).font('Helvetica-Bold');
            doc.text('Previous Reading', 50, 298)
               .text('Current Reading', 150, 298)
               .text('Units Consumed', 250, 298)
               .text('Rate Per Unit', 350, 298)
               .text('Fixed Charge', 450, 298);
               
            doc.strokeColor('#E0E0E0').moveTo(50, 312).lineTo(545, 312).stroke();

            // Table Values Row
            doc.fillColor('#333333').fontSize(9.5).font('Helvetica');
            doc.text(`${parseFloat(payload.previousReading || 0).toFixed(2)} kWh`, 50, 322)
               .text(`${parseFloat(payload.currentReading || 0).toFixed(2)} kWh`, 150, 322)
               .text(`${parseFloat(payload.units).toFixed(2)} kWh`, 250, 322)
               .text(`₹${parseFloat(payload.rate).toFixed(2)}`, 350, 322)
               .text(`₹${parseFloat(payload.fixedCharge || 0).toFixed(2)}`, 450, 322);

            doc.strokeColor('#0D253F').lineWidth(1.5).moveTo(50, 345).lineTo(545, 345).stroke();
            
            // Totals Box
            doc.rect(320, 360, 225, 110).fill('#F5F5F5');
            doc.fillColor('#333333').fontSize(9.5).font('Helvetica');
            doc.text('Energy Charge:', 340, 375);
            doc.text(`₹${(parseFloat(payload.units) * parseFloat(payload.rate)).toFixed(2)}`, 450, 375, { align: 'right', width: 80 });
            
            doc.text('Fixed Charge:', 340, 395);
            doc.text(`₹${parseFloat(payload.fixedCharge || 0).toFixed(2)}`, 450, 395, { align: 'right', width: 80 });

            doc.text('Tax / GST:', 340, 415);
            doc.text(`₹${parseFloat(payload.tax || 0).toFixed(2)}`, 450, 415, { align: 'right', width: 80 });

            doc.strokeColor('#D7D7D7').lineWidth(1).moveTo(330, 435).lineTo(535, 435).stroke();
            
            doc.fillColor('#0D253F').fontSize(11).font('Helvetica-Bold');
            doc.text('Total Amount:', 340, 445);
            doc.text(`₹${amount.toFixed(2)}`, 450, 445, { align: 'right', width: 80 });

            // Payment Status Banner
            doc.rect(50, 375, 120, 32).fill('#E8F5E9');
            doc.fillColor('#2E7D32').fontSize(12).font('Helvetica-Bold').text('PAID', 93, 385);

            // Footer
            doc.strokeColor('#E0E0E0').lineWidth(1).moveTo(50, 720).lineTo(545, 720).stroke();
            doc.fillColor('#777777').fontSize(8).font('Helvetica');
            doc.text('Generated by SmartGrid Utility Management Platform', 50, 730, { align: 'center', width: 495 });
            doc.text(`Generation Timestamp: ${new Date().toLocaleString()}`, 50, 742, { align: 'center', width: 495 });
            
            doc.end();
          } catch (err) {
            console.error('[Local Fallback] PDF Generation failed:', err);
            reject(err);
          }
        });
      }
    );
    
    const amount = billResult.amount;
    const fileName = billResult.s3_key || `bill_${consumer.consumer_number}_${billingMonth}.pdf`;

    // 5. Save Bill record in DB
    const bill = await Bill.create({
      consumer_id: consumerId,
      billing_month: billingMonth,
      units_used: totalUnits,
      amount,
      total_amount: amount,
      status: 'PAID', // It is prepaid, so it is registered as paid by default
      pdf_path: fileName,
      s3_key: fileName,
      generated_at: new Date()
    }, { transaction });

    // 6. Create notification alert for consumer user
    await Notification.create({
      user_id: consumer.user_id,
      title: 'New Monthly Bill Available',
      message: `Your monthly statement for ${billingMonth} is generated. Units used: ${totalUnits.toFixed(2)} kWh. Total statement cost: ₹${amount.toFixed(2)}. Receipt is ready for download.`,
      type: 'BILL'
    }, { transaction });

    await transaction.commit();
    return res.status(201).json({
      message: 'Monthly bill generated and receipt stored.',
      bill
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Bill Generation Error:', error);
    return res.status(500).json({ error: `Internal server error during bill generation: ${error.message}` });
  }
});

// GET download bill pre-signed URL
// GET download bill PDF directly
app.get('/api/bills/:id/download', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const bill = await Bill.findByPk(id, { include: [{ model: Consumer, as: 'consumer' }] });
    if (!bill) {
      return res.status(404).json({ error: 'Bill statement not found' });
    }

    // Auth verification: consumers can only download their own bills
    if (req.user.role === 'CONSUMER' && bill.consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to download this statement' });
    }

    try {
      const { downloadBill } = require('../../shared/database/s3-helper');
      await downloadBill(bill.pdf_path, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to stream bill file' });
      }
    }
  } catch (error) {
    console.error('Download Bill Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/bills/my-bills (Returns bill history for logged in consumer)
app.get('/api/bills/my-bills', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'CONSUMER') {
      return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    }
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });

    const bills = await Bill.findAll({
      where: { consumer_id: consumer.id },
      order: [['billing_month', 'DESC']]
    });

    console.log(`[DEBUG My Bills API] Logged In User ID: ${req.user.id}, Consumer ID: ${consumer.id}, Bills Retrieved: ${JSON.stringify(bills.map(b => b.id))}, Bills Count: ${bills.length}`);

    return res.status(200).json(bills);
  } catch (error) {
    console.error('Fetch Consumer Bills Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bills/my-bills/:id (Returns bill details for logged in consumer)
app.get('/api/bills/my-bills/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'CONSUMER') {
      return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    }
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });

    const bill = await Bill.findOne({
      where: { id, consumer_id: consumer.id },
      include: [{ model: Consumer, as: 'consumer' }]
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    return res.status(200).json(bill);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bills/my-bills/:id/download (Streams bill PDF directly for logged in consumer)
app.get('/api/bills/my-bills/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'CONSUMER') {
      return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    }
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });

    const bill = await Bill.findOne({
      where: { id, consumer_id: consumer.id }
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { downloadBill } = require('../../shared/database/s3-helper');
    const fileKey = bill.s3_key || bill.pdf_path;
    if (!fileKey) return res.status(404).json({ error: 'Bill PDF not found in records' });

    await downloadBill(fileKey, res);
  } catch (error) {
    console.error('Download Bill Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET local download fallback
app.get('/api/bills/local-download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const { downloadBill } = require('../../shared/database/s3-helper');
    await downloadBill(fileName, res);
  } catch (err) {
    console.error('Local download error:', err);
    if (!res.headersSent) {
      return res.status(404).json({ error: 'File not found' });
    }
  }
});

// GET specific bill details
app.get('/api/bills/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const bill = await Bill.findByPk(id, { include: [{ model: Consumer, as: 'consumer' }] });
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    if (req.user.role === 'CONSUMER' && bill.consumer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this bill' });
    }
    
    return res.status(200).json(bill);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});



// Compatibility endpoints
app.get('/api/consumer/bills', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'CONSUMER') return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });
    const bills = await Bill.findAll({ where: { consumer_id: consumer.id }, order: [['billing_month', 'DESC']] });
    return res.status(200).json(bills);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/consumer/bills/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'CONSUMER') return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });
    const bill = await Bill.findOne({ where: { id, consumer_id: consumer.id }, include: [{ model: Consumer, as: 'consumer' }] });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    return res.status(200).json(bill);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/consumer/bills/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'CONSUMER') return res.status(403).json({ error: 'Only consumers can access this endpoint' });
    const consumer = await Consumer.findOne({ where: { user_id: req.user.id } });
    if (!consumer) return res.status(404).json({ error: 'Consumer profile not found' });
    const bill = await Bill.findOne({ where: { id, consumer_id: consumer.id } });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const { downloadBill } = require('../../shared/database/s3-helper');
    await downloadBill(bill.s3_key || bill.pdf_path, res);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE bill (Staff/Admin only)
app.delete('/api/bills/:id', authenticate, authorize(['STAFF', 'ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    const bill = await Bill.findByPk(id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Delete file from S3 / local fallback
    if (bill.pdf_path) {
      const { deleteBill } = require('../../shared/database/s3-helper');
      await deleteBill(bill.pdf_path);
    }

    await bill.destroy();
    return res.status(200).json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete Bill Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
