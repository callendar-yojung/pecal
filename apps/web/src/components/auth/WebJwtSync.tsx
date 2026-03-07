"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function WebJwtSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.sessionId) {
      return;
    }

    const storageKey = `pecal:web-jwt-sync:${session.user.sessionId}`;
    if (window.sessionStorage.getItem(storageKey) === "done") {
      return;
    }

    let active = true;

    const sync = async () => {
      try {
        const response = await fetch("/api/auth/exchange-token", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to sync JWT session");
        }

        if (active) {
          window.sessionStorage.setItem(storageKey, "done");
          window.dispatchEvent(new CustomEvent("pecal:web-jwt-synced"));
        }
      } catch (error) {
        console.error("Failed to sync web JWT session:", error);
      }
    };

    void sync();

    return () => {
      active = false;
    };
  }, [session?.user?.sessionId, status]);

  return null;
}
