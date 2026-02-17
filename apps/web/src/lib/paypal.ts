import paypal from "@paypal/checkout-server-sdk";

// PayPal 환경 설정
function environment() {
  const clientId = process.env.SENDBOX_CLIENT_ID || "";
  const clientSecret = process.env.SENDBOX_CLIENT_SECRET || "";

  // Sandbox 환경 (테스트용)
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);

  // Production 환경을 사용하려면 아래 주석 해제
  // return new paypal.core.LiveEnvironment(clientId, clientSecret);
}

// PayPal 클라이언트 생성
function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

// 주문 생성
export async function createOrder(amount: number, currency = "USD") {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
  });

  try {
    const response = await client().execute(request);
    return {
      id: response.result.id,
      status: response.result.status,
    };
  } catch (error) {
    console.error("PayPal 주문 생성 오류:", error);
    throw error;
  }
}

// 주문 승인 및 결제 완료
export async function captureOrder(orderId: string) {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  try {
    const response = await client().execute(request);
    return {
      id: response.result.id,
      status: response.result.status,
      payer: response.result.payer,
      purchase_units: response.result.purchase_units,
    };
  } catch (error) {
    console.error("PayPal 결제 승인 오류:", error);
    throw error;
  }
}

// 주문 상세 조회
export async function getOrder(orderId: string) {
  const request = new paypal.orders.OrdersGetRequest(orderId);

  try {
    const response = await client().execute(request);
    return response.result;
  } catch (error) {
    console.error("PayPal 주문 조회 오류:", error);
    throw error;
  }
}

// 환불 처리
export async function refundCapture(captureId: string, amount?: number, currency = "USD") {
  const request = new paypal.payments.CapturesRefundRequest(captureId);
  request.requestBody(
    amount
      ? {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        }
      : {}
  );

  try {
    const response = await client().execute(request);
    return response.result;
  } catch (error) {
    console.error("PayPal 환불 오류:", error);
    throw error;
  }
}
