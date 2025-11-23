import { NextRequest, NextResponse } from "next/server";

// Ensure this route runs in the Node.js runtime (not edge)
export const runtime = "nodejs";

// Optional: disable SSL certificate verification in development
// WARNING: Only enable this for local/testing environments.
if (process.env.NEXT_PUBLIC_DISABLE_SSL_VERIFICATION === "true") {
  // @ts-ignore - NODE_TLS_REJECT_UNAUTHORIZED is not typed on process.env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_VINIAPP_BACKEND;

    if (!backendUrl) {
      return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 });
    }

    const response = await fetch(`${backendUrl}/api/create-viniapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || "Backend request failed" }, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
