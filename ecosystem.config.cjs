module.exports = {
  apps: [
    {
      name: "spotipi-backend",
      script: "backend/dist/index.js",
      cwd: "/home/ubuntu/websites/spotipi",
      interpreter: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node",
      kill_timeout: 3000,
      restart_delay: 3000,
      max_restarts: 5,
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
    },
    {
      name: "spotipi-frontend",
      script: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/serve",
      args: "-s frontend/dist -l 5174",
      cwd: "/home/ubuntu/websites/spotipi",
      interpreter: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
