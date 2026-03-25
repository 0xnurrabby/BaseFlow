import { NextResponse } from "next/server";

function toAsciiHex(value: string) {
  return Array.from(value)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

function buildSuffix(builderCode: string) {
  const code = builderCode.trim();
  if (!code) return "";
  const asciiHex = toAsciiHex(code);
  const lengthByte = (asciiHex.length / 2).toString(16).padStart(2, "0");
  return `0x${asciiHex}${lengthByte}0080218021802180218021802180218021`;
}

export async function GET() {
  return NextResponse.json({
    contract: process.env.BASEFLOW_CONTRACT || "",
    chainId: Number(process.env.CHAIN_ID || "8453"),
    networkName: process.env.NETWORK_NAME || "Base Mainnet",
    builderCode: process.env.BUILDER_CODE || "",
    builderSuffix: buildSuffix(process.env.BUILDER_CODE || ""),
    hasPaymaster: !!process.env.PAYMASTER_URL,
  });
}
