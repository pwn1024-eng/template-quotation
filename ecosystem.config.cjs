const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'quotation-document-generator',
      script: path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
