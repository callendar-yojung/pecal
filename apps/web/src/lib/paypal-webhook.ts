type PayPalWebhookEvent = Record<string, unknown>;

function getPayPalApiBaseUrl() {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getWebhookId() {
  return (
    process.env.PAYPAL_WEBHOOK_ID ||
    process.env.SENDBOX_PAYPAL_WEBHOOK_ID ||
    process.env.LIVE_PAYPAL_WEBHOOK_ID ||
    ""
  );
}

async function getPayPalAccessToken(): Promise<string> {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  const clientId =
    mode === "live"
      ? process.env.PAYPAL_CLIENT_ID || process.env.SENDBOX_CLIENT_ID || ""
      : process.env.SENDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";
  const clientSecret =
    mode === "live"
      ? process.env.PAYPAL_CLIENT_SECRET ||
        process.env.SENDBOX_CLIENT_SECRET ||
        ""
      : process.env.SENDBOX_CLIENT_SECRET ||
        process.env.PAYPAL_CLIENT_SECRET ||
        "";

  if (!clientId) throw new Error("PayPal client id is required");
  if (!clientSecret) throw new Error("PayPal client secret is required");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to get PayPal access token: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("PayPal access_token is missing");
  }

  return data.access_token;
}

export async function verifyPayPalWebhookSignature(
  headers: Headers,
  event: PayPalWebhookEvent,
): Promise<boolean> {
  const webhookId = getWebhookId();
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is required");
  }

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(
    `${getPayPalApiBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: event,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`PayPal verification failed: ${response.status}`);
  }

  const data = (await response.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
