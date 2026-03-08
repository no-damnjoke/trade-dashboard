module.exports = {
  apps: [
    {
      name: 'trade-dashboard',
      cwd: '/opt/trade-dashboard',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3001',
        ENABLE_DEV_ROUTES: 'false',
      },
    },
    {
      name: 'trade-dashboard-ai-proxy',
      cwd: '/opt/trade-dashboard',
      script: '/opt/trade-dashboard/.local/cliproxy/cli-proxy-api',
      args: '--config /opt/trade-dashboard/.cli-proxy-api.yaml',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
