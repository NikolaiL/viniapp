import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { gql, request } from "graphql-request";
import { join } from "path";
import { formatEther } from "viem";

export const runtime = "nodejs";
export const alt = "Greetings";
export const size = {
  width: 1200,
  height: 800,
};
export const contentType = "image/png";
export const revalidate = 600; // Revalidate every 10 minutes

type Greeting = {
  id: string;
  text: string;
  setterId: `0x${string}`;
  premium: boolean;
  value: bigint | string; // GraphQL may return as string
  timestamp: number;
};

type GreetingsData = {
  greetings: {
    items: Greeting[];
  };
};

async function getLatestGreeting(): Promise<Greeting | null> {
  try {
    const ponderUrl = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069";
    const GreetingsQuery = gql`
      query Greetings {
        greetings(orderBy: "timestamp", orderDirection: "desc") {
          items {
            id
            text
            setterId
            premium
            value
            timestamp
          }
        }
      }
    `;

    const data = await request<GreetingsData>(ponderUrl, GreetingsQuery);
    // Get the first (latest) greeting
    return data.greetings.items[0] || null;
  } catch (error) {
    console.error("Error fetching greeting from Ponder:", error);
    return null;
  }
}

function formatAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function Image() {
  const greeting = await getLatestGreeting();

  // If no greeting found or no connection to Ponder, return static thumbnail
  if (!greeting) {
    try {
      const publicDir = join(process.cwd(), "public");
      const thumbnailPath = join(publicDir, "thumbnail_miniapp.jpg");
      const thumbnailBuffer = await readFile(thumbnailPath);

      return new NextResponse(new Uint8Array(thumbnailBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=600, s-maxage=600",
        },
      });
    } catch (error) {
      console.error("Error reading thumbnail file:", error);
      // If thumbnail can't be read, throw error
      throw new Error("No greeting available and thumbnail file not found");
    }
  }

  // Generate dynamic image with greeting data
  const greetingText = greeting.text;
  const walletAddress = greeting.setterId;
  const isPremium = greeting.premium;
  // Handle value as string or bigint from GraphQL
  const value = greeting.value
    ? typeof greeting.value === "string"
      ? BigInt(greeting.value)
      : greeting.value
    : BigInt(0);

  // Success color from global.css
  const successColor = "#34eeb6";
  const borderColor = isPremium ? successColor : "#DDDDDD"; // gray if not premium, green if premium

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFBFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          gap: "30px",
        }}
      >
        {/* Top: from address - outside the div, centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "36px",
            color: "#212639",
          }}
        >
          <span>Greeting by</span>
          <span
            style={{
              color: "#60a5fa",
              fontFamily: "monospace",
              fontWeight: "600",
            }}
          >
            {formatAddress(walletAddress)}
          </span>
        </div>

        {/* Main container: 1100 x 500 with border */}
        <div
          style={{
            width: "1100px",
            height: "500px",
            display: "flex",
            flexDirection: "column",
            border: `4px solid ${borderColor}`,
            borderRadius: "36px",
            backgroundColor: "#ffffff",
            padding: "10px",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Greeting text */}
          <div
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              color: "#212639",
              lineHeight: "1.2",
              width: "100%",
              textAlign: "center",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textOverflow: "ellipsis",
              margin: "0 auto",
            }}
          >
            {greetingText}
          </div>
        </div>

        {/* Bottom: Title - outside the div, centered */}
        <div
          style={{
            display: "flex",
            marginTop: "60px",
            alignItems: "center",
            fontSize: "48px",
            color: "#212639",
          }}
        >
          Scaffold-ETH 2 + MiniApp Extension
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
