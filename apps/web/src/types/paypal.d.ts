declare module "@paypal/checkout-server-sdk" {
  export namespace core {
    export class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment);
      execute(request: any): Promise<any>;
    }
  }

  export namespace orders {
    export class OrdersCreateRequest {
      prefer(value: string): void;
      requestBody(body: any): void;
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: any): void;
    }
    export class OrdersGetRequest {
      constructor(orderId: string);
    }
  }

  export namespace payments {
    export class CapturesRefundRequest {
      constructor(captureId: string);
      requestBody(body: any): void;
    }
  }
}

