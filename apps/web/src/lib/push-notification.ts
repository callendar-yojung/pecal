import { deactivatePushTokens, isLikelyExpoPushToken } from "./push-token";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_MAX_BATCH = 100;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<{ sent: number; invalidTokens: string[] }> {
  const validMessages = messages.filter((msg) => isLikelyExpoPushToken(msg.to));
  if (validMessages.length === 0) return { sent: 0, invalidTokens: [] };

  let sent = 0;
  const invalidTokens: string[] = [];
  const tokenIndex = new Map<string, string>();
  for (const msg of validMessages) tokenIndex.set(msg.to, msg.to);

  const chunks = chunk(validMessages, EXPO_MAX_BATCH);
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();

  for (const payload of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[push] Expo send failed:", res.status, text);
        continue;
      }

      const json = (await res.json()) as { data?: ExpoPushTicket[] };
      const tickets = json.data ?? [];
      sent += tickets.filter((ticket) => ticket.status === "ok").length;

      for (let i = 0; i < tickets.length; i += 1) {
        const ticket = tickets[i];
        if (
          ticket.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          const token = payload[i]?.to;
          if (token && tokenIndex.has(token)) invalidTokens.push(token);
        }
      }
    } catch (error) {
      console.error("[push] Expo send error:", error);
    }
  }

  const uniqueInvalidTokens = [...new Set(invalidTokens)];
  if (uniqueInvalidTokens.length > 0) {
    await deactivatePushTokens(uniqueInvalidTokens);
  }

  return { sent, invalidTokens: uniqueInvalidTokens };
}
