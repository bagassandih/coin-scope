module.exports = {
  apps: [{
    name: 'coinscope',
    script: 'src/server.js',
    interpreter: 'node',
    interpreter_args: '--experimental-loader',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Prevent infinite restart loops
    min_uptime: '10s',
    max_restarts: 10,
    kill_timeout: 5000,
    wait_ready: true,
    // Windows-specific: listen for the 'listening' event
    listen_timeout: 10000
  }]
};
