import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_URL || process.env.APP_URL || "https://txfree-sender.vercel.app";

export async function GET() {
  return NextResponse.json({
    miniapp: {
      version: "1",
      name: "BaseFlow",
      homeUrl: APP_URL,
      iconUrl: `${APP_URL}/icon.png`,
      splashImageUrl: `${APP_URL}/icon.png`,
      splashBackgroundColor: "#07103a",
      subtitle: "Batch token sender on Base",
      description: "Send ERC-20 tokens to many wallets from one clean interface.",
      primaryCategory: "finance",
      tagline: "Batch send on Base",
    },
  });
}
