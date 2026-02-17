import { createCipheriv } from "crypto";

const NICEPAY_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.nicepay.co.kr"
    : "https://sandbox-api.nicepay.co.kr";

function getSecretKey(): string {
  const key = process.env.NICEPAY_SECRET_KEY;
  if (!key) throw new Error("NICEPAY_SECRET_KEY is not configured");
  return key;
}

function getClientKey(): string {
  const key = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_NICEPAY_CLIENT_KEY is not configured");
  return key;
}

/** Basic Auth 헤더 생성: Base64(SecretKey:) */
function getAuthHeader(): string {
  const clientKey = getClientKey();
  const secretKey = getSecretKey();
  return Buffer.from(`${clientKey}:${secretKey}`).toString("base64");
}

function getEncryptKey(): string {
  const secretKey = getSecretKey();
  if (secretKey.length < 16) {
    throw new Error("NICEPAY_SECRET_KEY must be at least 16 characters");
  }
  return secretKey.slice(0, 16);
}

/** MOID 생성 */
export function generateMoid(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

interface BillingKeyResult {
  bid: string;
  cardCode: string;
  cardName: string;
  cardNo: string;
  resultCode: string;
  resultMsg: string;
}

interface CardRegisterParams {
  orderId: string;
  cardNo: string;
  expYear: string;
  expMonth: string;
  idNo: string;
  cardPw: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerTel?: string;
}

function normalizeResult(result: any): { code: string; msg: string } {
  const code = result.resultCode || result.ResultCode || "";
  const msg = result.resultMsg || result.ResultMsg || "";
  return { code, msg };
}

function encryptCardData(params: CardRegisterParams): string {
  const key = Buffer.from(getEncryptKey(), "utf8");
  const plain = [
    `cardNo=${params.cardNo}`,
    `expYear=${params.expYear}`,
    `expMonth=${params.expMonth}`,
    `idNo=${params.idNo}`,
    `cardPw=${params.cardPw}`,
  ].join("&");

  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(true);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]).toString("hex");
  return encrypted;
}

/**
 * 빌키(BID) 발급 API — V2 Modern
 * POST /v1/billing/{tid}
 */
export async function registerBillingKey(
  tid: string,
  orderId: string,
  amount: number,
  goodsName: string,
  cardQuota?: number
): Promise<BillingKeyResult> {
  const response = await fetch(`${NICEPAY_API_URL}/v1/billing/${tid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuthHeader()}`,
    },
    body: JSON.stringify({
      orderId,
      amount,
      goodsName,
      cardQuota: cardQuota ?? 0,
    }),
  });

  const result = await response.json();
  console.log("[NicePay Billing] Register result:", JSON.stringify(result));

  if (result.resultCode !== "0000") {
    throw new Error(result.resultMsg || "빌키 발급 실패");
  }

  return {
    bid: result.bid,
    cardCode: result.card?.cardCode || "",
    cardName: result.card?.cardName || "",
    cardNo: result.card?.cardNo || "",
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
  };
}

/**
 * 빌키(BID) 발급 API — 카드정보 직접 입력 방식
 * POST /v1/subscribe/regist
 */
export async function registerBillingKeyByCard(
  params: CardRegisterParams
): Promise<BillingKeyResult> {
  const { orderId, buyerName, buyerEmail, buyerTel } = params;
  const encData = encryptCardData(params);

  const response = await fetch(`${NICEPAY_API_URL}/v1/subscribe/regist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuthHeader()}`,
    },
    body: JSON.stringify({
      orderId,
      encData,
      buyerName,
      buyerEmail,
      buyerTel,
    }),
  });

  const result = await response.json();
  const { code, msg } = normalizeResult(result);
  console.log("[NicePay Billing] Register result:", JSON.stringify(result));

  if (code !== "0000") {
    throw new Error(msg || "빌키 발급 실패");
  }

  return {
    bid: result.bid || result.BID || "",
    cardCode: result.cardCode || result.card?.cardCode || "",
    cardName: result.cardName || result.card?.cardName || "",
    cardNo: result.cardNo || result.card?.cardNo || "",
    resultCode: code,
    resultMsg: msg,
  };
}

interface BillingApproveResult {
  tid: string;
  amt: number;
  resultCode: string;
  resultMsg: string;
}

interface BillingApproveByBidParams {
  bid: string;
  orderId: string;
  amount: number;
  goodsName: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerTel?: string;
}

/**
 * 빌링 승인 — 카드정보 직접 입력 방식
 * POST /v1/subscribe/{bid}/payments
 */
export async function approveBillingByBid(
  params: BillingApproveByBidParams
): Promise<BillingApproveResult> {
  const { bid, orderId, amount, goodsName, buyerName, buyerEmail, buyerTel } =
    params;
  const response = await fetch(
    `${NICEPAY_API_URL}/v1/subscribe/${bid}/payments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${getAuthHeader()}`,
      },
      body: JSON.stringify({
        orderId,
        amount,
        goodsName,
        cardQuota: 0,
        useShopInterest: false,
        buyerName,
        buyerEmail,
        buyerTel,
      }),
    }
  );

  const result = await response.json();
  const { code, msg } = normalizeResult(result);
  console.log("[NicePay Billing] Approve result:", JSON.stringify(result));

  if (code !== "0000") {
    throw new Error(msg || "빌링 승인 실패");
  }

  return {
    tid: result.tid || "",
    amt: result.amount || amount,
    resultCode: code,
    resultMsg: msg,
  };
}

/**
 * 빌링 재결제(정기결제) API — V2 Modern
 * POST /v1/billing/re-pay
 */
export async function approveBilling(
  bid: string,
  orderId: string,
  amount: number,
  goodsName: string,
  cardQuota?: number
): Promise<BillingApproveResult> {
  const response = await fetch(`${NICEPAY_API_URL}/v1/billing/re-pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuthHeader()}`,
    },
    body: JSON.stringify({
      bid,
      orderId,
      amount,
      goodsName,
      cardQuota: cardQuota ?? 0,
      useShopInterest: false,
    }),
  });

  const result = await response.json();
  console.log("[NicePay Billing] Approve result:", JSON.stringify(result));

  if (result.resultCode !== "0000") {
    throw new Error(result.resultMsg || "빌링 승인 실패");
  }

  return {
    tid: result.tid || "",
    amt: result.amount || amount,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
  };
}

interface ExpireBillingKeyResult {
  resultCode: string;
  resultMsg: string;
}

/**
 * 빌링키(BID) 만료 API
 * POST /v1/subscribe/{bid}/expire
 */
export async function expireBillingKey(
  bid: string,
  orderId: string
): Promise<ExpireBillingKeyResult> {
  const response = await fetch(
    `${NICEPAY_API_URL}/v1/subscribe/${bid}/expire`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${getAuthHeader()}`,
      },
      body: JSON.stringify({ orderId }),
    }
  );

  const result = await response.json();
  console.log("[NicePay Billing] Expire result:", JSON.stringify(result));

  return {
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
  };
}
