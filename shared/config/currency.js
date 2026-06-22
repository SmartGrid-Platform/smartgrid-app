module.exports = {
  code: 'INR',
  symbol: '₹',
  name: 'Indian Rupee',
  format: (amount) => `₹${parseFloat(amount).toFixed(2)}`
};
