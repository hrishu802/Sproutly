import { app } from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`🌱 Sproutly backend server listening on port ${config.port}`);
  console.log(`   HF_TOKEN configured: ${Boolean(config.hfToken)}`);
  console.log(`   Vision Model: ${config.hfVisionModel}`);
  console.log(`   Text Model: ${config.hfTextModel}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
