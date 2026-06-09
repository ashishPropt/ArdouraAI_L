module.exports = {
  apps: [
    {
      name: 'ardoura-ai',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/ardoura-ai',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
