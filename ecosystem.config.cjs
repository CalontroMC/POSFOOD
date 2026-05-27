// PM2 config for Windows.
// ใช้คู่กับ pm2-windows-startup เพื่อให้รัน auto-start
// คำสั่ง:
//   npm run build
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2-startup install     (Windows: pm2-windows-startup)
module.exports = {
  apps: [
    {
      name: "foodpos",
      script: "server/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "logs/foodpos.out.log",
      error_file: "logs/foodpos.err.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "foodpos-tunnel",
      script: "cloudflared",
      args: "tunnel --url http://localhost:3000",
      interpreter: "none",
      out_file: "logs/tunnel.out.log",
      error_file: "logs/tunnel.err.log",
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 50,
    },
  ],
};
