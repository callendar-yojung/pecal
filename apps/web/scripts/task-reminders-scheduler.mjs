import path from 'path';
import { fileURLToPath } from 'url';

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:3000';
const INTERVAL_MS = 60 * 1000; // 1 minute

if (!CRON_SECRET) {
  console.error('[Scheduler] CRON_SECRET is not set. Exiting.');
  process.exit(1);
}

console.log(`[Scheduler] Starting task reminder scheduler calling ${BASE_URL}/api/cron/task-reminders every 1 minute`);

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

triggerTaskReminders();
setInterval(triggerTaskReminders, INTERVAL_MS);
