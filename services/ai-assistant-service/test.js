require('dotenv').config();
process.env.AWS_REGION = 'ap-south-1'; // or whatever region they are using
const bedrockProvider = require('./services/bedrockProvider');

async function test() {
  try {
    console.log("Testing Bedrock Provider...");
    const result = await bedrockProvider.generateResponse("You are a helpful assistant.", "Hello, world!");
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
