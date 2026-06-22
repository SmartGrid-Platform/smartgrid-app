const { sequelize, DataTypes } = require('../models');

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  
  // Add total_amount
  try {
    await queryInterface.addColumn('bills', 'total_amount', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    });
    console.log('Added total_amount column');
  } catch (err) {
    console.log('Column total_amount may already exist:', err.message);
  }

  // Add s3_key
  try {
    await queryInterface.addColumn('bills', 's3_key', {
      type: DataTypes.STRING,
      allowNull: true
    });
    console.log('Added s3_key column');
  } catch (err) {
    console.log('Column s3_key may already exist:', err.message);
  }

  // Add generated_at
  try {
    await queryInterface.addColumn('bills', 'generated_at', {
      type: DataTypes.DATE,
      allowNull: true
    });
    console.log('Added generated_at column');
  } catch (err) {
    console.log('Column generated_at may already exist:', err.message);
  }
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  
  await queryInterface.removeColumn('bills', 'total_amount');
  await queryInterface.removeColumn('bills', 's3_key');
  await queryInterface.removeColumn('bills', 'generated_at');
}

if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { up, down };
