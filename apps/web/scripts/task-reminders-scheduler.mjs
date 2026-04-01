const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:3000';
const INTERVAL_MS = 60 * 1000; // 1 minute
const INITIAL_DELAY_MS = Number(process.env.REMINDER_INITIAL_DELAY_MS ?? 15 * 1000);

if (!CRON_SECRET) {
  console.error('[Scheduler] CRON_SECRET is not set. Exiting.');
  process.exit(1);
}

console.log(
  `[Scheduler] Starting task reminder scheduler calling ${BASE_URL}/api/cron/task-reminders every 1 minute (initial delay ${Math.max(0, INITIAL_DELAY_MS)}ms)`,
);

async function triggerTaskReminders() {
  const url = `${BASE_URL}/api/cron/task-reminders`;
  console.log(`[${new Date().toISOString()}] Triggering reminders...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`[${new Date().toISOString()}] Success:`, data);
    } else {
      console.error(`[${new Date().toISOString()}] Failed (Status ${response.status}):`, data);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error calling API:`, error.message);
  }
}

setTimeout(() => {
  void triggerTaskReminders();
  setInterval(() => {
    void triggerTaskReminders();
  }, INTERVAL_MS);
}, Math.max(0, INITIAL_DELAY_MS));
