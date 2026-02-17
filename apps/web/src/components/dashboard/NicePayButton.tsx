"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (options: Record<string, unknown>) => void;
    };
  }
}

interface NicePayButtonProps {
  planId: number;
  amount: number;
  goodsName: string;
  ownerId: number;
  ownerType: "team" | "personal";
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
  onError?: (error: string) => void;
}

export default function NicePayButton({
  planId,
  amount,
  goodsName,
  ownerId,
  ownerType,
  buyerName,
  buyerEmail,
  buyerTel,
  onError,
}: NicePayButtonProps) {
  const t = useTranslations("dashboard.settings.billing.checkout.nicepay");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document.querySelector('script[src*="nicepay"]')) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://pay.nicepay.co.kr/v1/js/";
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => {
      console.error("Failed to load NicePay SDK");
      onError?.(t("sdkLoadError"));
    };
    document.head.appendChild(script);
  }, []);

  const handlePayment = () => {
    if (!window.AUTHNICE) {
      onError?.(t("sdkLoadError"));
      return;
    }

    setLoading(true);

    const clientKey = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
    if (!clientKey) {
      onError?.("NicePay client key is not configured");
      setLoading(false);
      return;
    }

    const orderId = `PECAL_${ownerId}_${Date.now()}`;
    const returnUrl = `${window.location.origin}/api/nicepay/billing/register?plan_id=${planId}&owner_id=${ownerId}&owner_type=${ownerType}`;

    const buyerInfo =
      buyerName || buyerEmail || buyerTel
        ? { buyerName, buyerEmail, buyerTel }
        : {};

    window.AUTHNICE.requestPay({
      clientId: clientKey,
      method: "card",
      orderId,
      amount,
      goodsName,
      returnUrl,
      ...buyerInfo,
      fnError: (result: { errorMsg?: string }) => {
        setLoading(false);
        onError?.(result.errorMsg || t("error"));
      },
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handlePayment}
        disabled={!sdkLoaded || loading}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? t("subscribing")
          : !sdkLoaded
            ? t("loading")
            : t("subscribeButton")}
      </button>
    </div>
  );
}
