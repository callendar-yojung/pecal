"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  planId: number;
  paypalPlanId?: string | null;
  ownerId: number;
  ownerType: "team" | "personal";
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export default function PayPalButton({
  planId,
  paypalPlanId,
  ownerId,
  ownerType,
  onSuccess,
  onError,
}: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // PayPal Plan ID가 없으면 SDK 로드하지 않음
    if (!paypalPlanId) {
      setLoading(false);
      setError("PayPal Plan ID가 설정되지 않았습니다.");
      return;
    }

    // 이미 로드된 스크립트가 있으면 제거
    const existingScript = document.querySelector('script[data-paypal-sdk]');
    if (existingScript) {
      existingScript.remove();
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

    if (!clientId || clientId === 'sb') {
      setLoading(false);
      setError("PayPal Client ID가 설정되지 않았습니다.");
      return;
    }

    // PayPal SDK 스크립트 로드
    const script = document.createElement("script");
    script.setAttribute('data-paypal-sdk', 'true');
    // 구독 기능을 위한 파라미터
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription&currency=USD`;
    script.async = true;

    script.onload = () => {
      console.log("PayPal SDK 로드 완료");
      setLoading(false);
      setSdkReady(true);
    };

    script.onerror = () => {
      console.error("PayPal SDK 로드 실패");
      setLoading(false);
      setError("PayPal SDK를 불러오는데 실패했습니다.");
      onError?.({ message: "PayPal SDK 로드 실패" });
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [paypalPlanId, onError]);

  useEffect(() => {
    if (sdkReady && window.paypal && paypalRef.current && paypalPlanId) {
      console.log("PayPal 버튼 렌더링 시작", {
        paypalPlanId,
        planId,
        ownerId,
        ownerType
      });
      renderPayPalButton();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, paypalPlanId]);

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalRef.current || !paypalPlanId) {
      console.error("PayPal SDK 또는 ref가 준비되지 않음");
      return;
    }

    // 기존 버튼 제거
    paypalRef.current.innerHTML = '';

    try {
      console.log("구독 버튼 생성 중, Plan ID:", paypalPlanId);

      window.paypal
        .Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "subscribe",
            height: 40
          },
          createSubscription: function(data: any, actions: any) {
            console.log("구독 생성 중, Plan ID:", paypalPlanId);
            return actions.subscription.create({
              plan_id: paypalPlanId,
            });
          },
          onApprove: async function(data: any) {
            console.log("구독 승인됨:", data);
            try {
              const response = await fetch("/api/paypal/subscription/activate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subscription_id: data.subscriptionID,
                  owner_id: ownerId,
                  owner_type: ownerType,
                  plan_id: planId,
                }),
              });

              const result = await response.json();

              if (!response.ok) {
                console.error("구독 활성화 실패:", result);
                onError?.(new Error(result.error || "구독 활성화 실패"));
                return;
              }

              console.log("구독 활성화 성공:", result);
              onSuccess?.(result);
            } catch (error) {
              console.error("구독 활성화 오류:", error);
              onError?.(error);
            }
          },
          onError: function(error: any) {
            console.error("PayPal 버튼 오류:", error);
            setError("PayPal 결제 처리 중 오류가 발생했습니다.");
            onError?.(error);
          },
          onCancel: function(data: any) {
            console.log("사용자가 결제를 취소함:", data);
          }
        })
        .render(paypalRef.current)
        .then(() => {
          console.log("PayPal 구독 버튼 렌더링 완료");
        })
        .catch((err: any) => {
          console.error("PayPal 버튼 렌더링 실패:", err);
          setError("PayPal 버튼을 표시하는데 실패했습니다.");
          onError?.(err);
        });
    } catch (err) {
      console.error("PayPal 버튼 생성 실패:", err);
      setError("PayPal 버튼 생성 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">PayPal SDK 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  if (!paypalPlanId) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ 이 플랜은 PayPal 구독이 설정되지 않았습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="w-full" />
    </div>
  );
}
