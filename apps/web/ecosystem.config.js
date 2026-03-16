module.exports = {
  apps: [
    {
      name: "pecal-scheduler",
      script: "node",
      args: "scripts/task-reminders-scheduler.mjs",
      cwd: "/home/callendar/apps/api",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env.production",
    },
    {
      name: "callendar-api",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/home/callendar/apps/api",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: ".env.production", // 환경 변수 파일 추가
    },
  ],
};
