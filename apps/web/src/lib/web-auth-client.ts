"use client";

import { signOut } from "next-auth/react";

export async function logoutWebSession(callbackUrl = "/") {
  try {
    await fetch("/api/auth/external/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch (error) {
    console.error("Failed to clear JWT session during logout:", error);
  }

  await signOut({ callbackUrl });
}
