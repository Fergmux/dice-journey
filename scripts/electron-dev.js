import { spawn, exec } from 'child_process';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startElectron() {
  // Build electron files first
  console.log('Building Electron files...');
  await new Promise((resolve, reject) => {
    exec('npm run electron:build-main', (error, stdout, stderr) => {
      if (error) {
        console.error('Error building Electron files:', stderr);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve();
    });
  });

  // Start Vite dev server
  console.log('Starting Vite dev server...');
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
  });
  await server.listen();

  const address = server.httpServer.address();
  const port = typeof address === 'object' ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`Vite dev server running at ${url}`);

  // Start Electron
  console.log('Starting Electron...');
  const electronPath = path.resolve(__dirname, '../node_modules/.bin/electron');
  const mainPath = path.resolve(__dirname, '../dist-electron/main.js');

  const electronProcess = spawn(electronPath, [mainPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url,
    },
  });

  electronProcess.on('close', () => {
    server.close();
    process.exit();
  });

  process.on('SIGINT', () => {
    electronProcess.kill();
    server.close();
    process.exit();
  });
}

startElectron().catch(console.error);
