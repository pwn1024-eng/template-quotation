module.exports = {
  apps: [
    {
      name: "quotation-document-generator",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 11111", // Change 3000 to your desired port
      instances: "max",      // Leverages all CPU cores (cluster mode)
      exec_mode: "cluster",  
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@localhost:5432/mydb" // Your production DB connection
      }
    }
  ]
};
