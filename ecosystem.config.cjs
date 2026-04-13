module.exports = {
  apps: [
    {
      name: "spotipi-backend",
      script: "backend/dist/index.js",
      cwd: "/home/ubuntu/websites/spotipi",
      interpreter: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "spotipi-frontend",
      script: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/serve",
      args: "-s frontend/dist -l 5173",
      cwd: "/home/ubuntu/websites/spotipi",
      interpreter: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
