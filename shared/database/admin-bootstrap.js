const bcrypt = require('bcryptjs');
const { loadSecrets } = require('./secrets-manager');

async function bootstrapAdmin() {
  await loadSecrets();
  const { User } = require('./models');

  console.log('\n--- SmartGrid Admin Bootstrapper ---');

  let name = process.env.ADMIN_NAME;
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('Admin credentials not detected in environment. Interactive setup:');
    name = await askQuestion('Enter Admin Name: ');
    while (!name.trim()) {
      name = await askQuestion('Name cannot be empty. Enter Admin Name: ');
    }

    email = await askQuestion('Enter Admin Email: ');
    while (!email.trim() || !email.includes('@')) {
      email = await askQuestion('Please enter a valid email: ');
    }

    password = await askQuestion('Enter Admin Password: ');
    while (password.length < 6) {
      password = await askQuestion('Password must be at least 6 characters: ');
    }

    rl.close();
  }

  try {
    // Check if user already exists
    const existingAdmin = await User.findOne({ where: { email } });
    if (existingAdmin) {
      console.log(`\nUser with email ${email} already exists.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password_hash: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    console.log(`\nSuccess: Admin user "${name}" (${email}) created successfully.`);

    // Do not seed default tariffs (blank slate requested)

    process.exit(0);
  } catch (error) {
    console.error('\nError bootstrapping Admin user:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrapAdmin();
}

module.exports = bootstrapAdmin;
