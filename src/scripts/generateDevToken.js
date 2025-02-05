import { generateCustomeDevToken } from '../utils/firebaseUtils/authFire.js';

async function run() {
  try {
    const token = await generateCustomeDevToken('testeray@gmail.com');
    console.log(`Generating Dev Token for testeray@gmail.com: ${token} `);
  } catch (e) {
    throw new Error(e);
  }
}

run();
