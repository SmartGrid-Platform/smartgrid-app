const { DataTypes, Op } = require('sequelize');
const sequelize = require('./connection');

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('CONSUMER', 'STAFF', 'ADMIN'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true
});

// Consumer Model
const Consumer = sequelize.define('Consumer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  consumer_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  connection_status: {
    type: DataTypes.ENUM('CONNECTED', 'DISCONNECTED'),
    allowNull: false,
    defaultValue: 'CONNECTED'
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  }
}, {
  tableName: 'consumers',
  underscored: true,
  timestamps: true
});

// Meter Model
const Meter = sequelize.define('Meter', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  meter_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  consumer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'consumers',
      key: 'id'
    }
  },
  tariff_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'tariffs',
      key: 'id'
    }
  },
  meter_type: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'SMART'
  },
  installation_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'TAMPERED'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  }
}, {
  tableName: 'meters',
  underscored: true,
  timestamps: true
});

// MeterReading Model
const MeterReading = sequelize.define('MeterReading', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  meter_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'meters',
      key: 'id'
    }
  },
  units_consumed: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  reading_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'meter_readings',
  underscored: true,
  timestamps: true
});

// Tariff Model
const Tariff = sequelize.define('Tariff', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  tariff_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tariff_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rate_per_unit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  fixed_charge: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  }
}, {
  tableName: 'tariffs',
  underscored: true,
  timestamps: true
});

// Recharge Model
const Recharge = sequelize.define('Recharge', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  consumer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'consumers',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  balance_added: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  tableName: 'recharges',
  underscored: true,
  timestamps: true
});

// Bill Model
const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  consumer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'consumers',
      key: 'id'
    }
  },
  billing_month: {
    type: DataTypes.STRING, // e.g. "2026-06"
    allowNull: false
  },
  units_used: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('PAID', 'UNPAID'),
    allowNull: false,
    defaultValue: 'PAID'
  },
  pdf_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  s3_key: {
    type: DataTypes.STRING,
    allowNull: true
  },
  generated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'bills',
  underscored: true,
  timestamps: true
});

// Notification Model
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('LOW_BALANCE', 'TAMPER', 'RECHARGE', 'BILL', 'SYSTEM', 'INSPECTION'),
    allowNull: false
  }
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true
});

// Inspection Model
const Inspection = sequelize.define('Inspection', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  consumer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'consumers',
      key: 'id'
    }
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'COMPLETED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  assigned_to: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'inspections',
  underscored: true,
  timestamps: true
});

// Associations
User.hasOne(Consumer, { foreignKey: 'user_id', as: 'consumer' });
Consumer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Consumer.hasMany(Meter, { foreignKey: 'consumer_id', as: 'meters' });
Meter.belongsTo(Consumer, { foreignKey: 'consumer_id', as: 'consumer' });

Meter.hasMany(MeterReading, { foreignKey: 'meter_id', as: 'readings' });
MeterReading.belongsTo(Meter, { foreignKey: 'meter_id', as: 'meter' });

Consumer.hasMany(Recharge, { foreignKey: 'consumer_id', as: 'recharges' });
Recharge.belongsTo(Consumer, { foreignKey: 'consumer_id', as: 'consumer' });

Consumer.hasMany(Bill, { foreignKey: 'consumer_id', as: 'bills' });
Bill.belongsTo(Consumer, { foreignKey: 'consumer_id', as: 'consumer' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Consumer.hasMany(Inspection, { foreignKey: 'consumer_id', as: 'inspections' });
Inspection.belongsTo(Consumer, { foreignKey: 'consumer_id', as: 'consumer' });

User.hasMany(Inspection, { foreignKey: 'assigned_to', as: 'assignedInspections' });
Inspection.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

Meter.belongsTo(Tariff, { foreignKey: 'tariff_id', as: 'tariff' });
Tariff.hasMany(Meter, { foreignKey: 'tariff_id', as: 'meters' });

module.exports = {
  sequelize,
  Op,
  User,
  Consumer,
  Meter,
  MeterReading,
  Tariff,
  Recharge,
  Bill,
  Notification,
  Inspection
};

