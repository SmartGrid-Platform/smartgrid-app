const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const { sequelize, User, Consumer } = require('../../shared/database/models');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'smartgrid_secret';

// Express Middlewares
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
  const limit = 100; // 100 requests
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
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
  res.status(200).json({ status: 'healthy', service: 'auth-service', timestamp: new Date() });
});
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'auth-service', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'auth-service', timestamp: new Date() });
});

// Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'CONSUMER', address, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Security check: Only Admins can register non-consumer roles
  if (role !== 'CONSUMER') {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ error: 'Only administrators can create staff or admin accounts' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only administrators can create staff or admin accounts' });
      }
    } catch (err) {
      return res.status(403).json({ error: 'Invalid token, admin authorization failed' });
    }
  }

  const transaction = await sequelize.transaction();
  try {
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password_hash: passwordHash,
      role,
      status: 'ACTIVE'
    }, { transaction });

    let consumer = null;
    if (role === 'CONSUMER') {
      const consumer_number = 'CON-' + Math.floor(10000000 + Math.random() * 90000000);
      consumer = await Consumer.create({
        user_id: user.id,
        consumer_number,
        address: address || 'Not Provided',
        phone: phone || 'Not Provided',
        connection_status: 'CONNECTED',
        balance: 0.00
      }, { transaction });
    }

    await transaction.commit();

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      consumer: consumer ? {
        id: consumer.id,
        consumer_number: consumer.consumer_number,
        connection_status: consumer.connection_status,
        balance: consumer.balance
      } : null
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Registration Error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  console.log(`[AUTH-DEBUG] Login attempt - Email: ${email}`);

  try {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Consumer, as: 'consumer' }]
    });

    if (!user) {
      console.log(`[AUTH-DEBUG] Login failed - User not found for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status !== 'ACTIVE') {
      console.log(`[AUTH-DEBUG] Login failed - User status is ${user.status} for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log(`[AUTH-DEBUG] Login failed - Password mismatch for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        consumerId: user.consumer ? user.consumer.id : null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        consumerId: user.consumer ? user.consumer.id : null,
        consumerNumber: user.consumer ? user.consumer.consumer_number : null
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Profile Endpoint
app.get('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Consumer, as: 'consumer' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('Profile Retrieval Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: Get all users
app.get('/api/auth/users', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Consumer, as: 'consumer' }]
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error('Get Users Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: Get specific user
app.get('/api/auth/users/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Consumer, as: 'consumer' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('Get User Details Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User status or credentials (Admin or self)
app.put('/api/auth/users/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, status } = req.body;

  // Check authorization (must be Admin or the user themselves)
  if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Unauthorized to update this profile' });
  }

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password_hash = await bcrypt.hash(password, 10);
    
    // Status update only allowed for Admin
    if (status && req.user.role === 'ADMIN') {
      user.status = status;
    }

    await user.save();
    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update User Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Route Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;
