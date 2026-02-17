import paypal from "@paypal/checkout-server-sdk";

// PayPal 환경 설정
function environment() {
  const clientId = process.env.SENDBOX_CLIENT_ID || "";
  const clientSecret = process.env.SENDBOX_CLIENT_SECRET || "";

  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

// PayPal 클라이언트 생성
function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

// PayPal 상품(Product) 생성
export async function createPayPalProduct(data: {
  name: string;
  description: string;
  type?: "PHYSICAL" | "DIGITAL" | "SERVICE";
}) {
  const request = {
    path: "/v1/catalogs/products",
    verb: "POST",
    body: {
      name: data.name,
      description: data.description,
      type: data.type || "SERVICE",
      category: "SOFTWARE",
    },
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await client().execute(request);
    return {
      id: response.result.id,
      name: response.result.name,
    };
  } catch (error) {
    console.error("PayPal 상품 생성 오류:", error);
    throw error;
  }
}

// PayPal 플랜(Billing Plan) 생성
export async function createPayPalBillingPlan(data: {
  product_id: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  interval_unit?: "DAY" | "WEEK" | "MONTH" | "YEAR";
  interval_count?: number;
}) {
  const request = {
    path: "/v1/billing/plans",
    verb: "POST",
    body: {
      product_id: data.product_id,
      name: data.name,
      description: data.description,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: data.interval_unit || "MONTH",
            interval_count: data.interval_count || 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 무제한
          pricing_scheme: {
            fixed_price: {
              value: data.price.toFixed(2),
              currency_code: data.currency || "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    },
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await client().execute(request);
    return {
      id: response.result.id,
      name: response.result.name,
      status: response.result.status,
    };
  } catch (error) {
    console.error("PayPal 플랜 생성 오류:", error);
    throw error;
  }
}

// PayPal 상품 목록 조회
export async function listPayPalProducts(page = 1, pageSize = 20) {
  const request = {
    path: `/v1/catalogs/products?page=${page}&page_size=${pageSize}`,
    verb: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await client().execute(request);
    return response.result.products || [];
  } catch (error) {
    console.error("PayPal 상품 목록 조회 오류:", error);
    throw error;
  }
}

// PayPal 플랜 목록 조회
export async function listPayPalPlans(productId?: string, page = 1, pageSize = 20) {
  const query = productId
    ? `product_id=${productId}&page=${page}&page_size=${pageSize}`
    : `page=${page}&page_size=${pageSize}`;

  const request = {
    path: `/v1/billing/plans?${query}`,
    verb: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await client().execute(request);
    return response.result.plans || [];
  } catch (error) {
    console.error("PayPal 플랜 목록 조회 오류:", error);
    throw error;
  }
}

