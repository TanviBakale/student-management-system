import './config/loadEnv.js';
import dns from 'node:dns';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { seedDefaultDepartments } from './controllers/departmentController.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const port = Number(process.env.PORT) || 5000;

async function start() {
  await connectDatabase();
  await seedDefaultDepartments();
  app.listen(port, () => console.log(`Student API listening on port ${port}`));
}

start().catch((error) => {
  console.error('Unable to start the student API:', error.message);
  process.exitCode = 1;
});
