import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, isAllowedOAuthCallback } from "@/lib/oauth-state";
import { getOAuthRedirectUri } from "@/lib/oauth-redirect-uri";

export async function GET(request: NextRequest) {
  try {
    const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
    const APPLE_CLIENT_ID = process.env.AUTH_APPLE_ID;

    if (!APPLE_CLIENT_ID) {
      return NextResponse.json(
        { error: "Apple client ID not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const appCallback = searchParams.get("callback");

    if (!appCallback) {
      return NextResponse.json(
        { error: "callback parameter is required" },
        { status: 400 }
      );
    }

    if (!isAllowedOAuthCallback(appCallback)) {
      return NextResponse.json(
        { error: "Invalid callback URL" },
        { status: 400 }
      );
    }

    const redirectUri = getOAuthRedirectUri(request, "apple");
    const { state } = await createOAuthState("apple", appCallback);

    const params = new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: "name email",
      state,
    });

    const authUrl = `${APPLE_AUTH_URL}?${params.toString()}`;

    return NextResponse.json({
      authUrl,
      redirectUri,
      state,
    });
  } catch (error) {
    console.error("Apple start error:", error);
    return NextResponse.json(
      { error: "Failed to start Apple OAuth", details: String(error) },
      { status: 500 }
    );
  }
}

