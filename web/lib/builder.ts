"use client";

const ERC8021_MARKER = "80218021802180218021802180218021";
const SCHEMA_ID = "00";

function toAsciiHex(value: string) {
  return Array.from(value)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

export function getBuilderSuffix(builderCode: string) {
  const code = builderCode.trim();
  if (!code) return "";
  const asciiHex = toAsciiHex(code);
  const lengthByte = (asciiHex.length / 2).toString(16).padStart(2, "0");
  return `0x${asciiHex}${lengthByte}${SCHEMA_ID}${ERC8021_MARKER}`;
}

export function appendHexSuffix(baseHex: string, suffixHex: string) {
  if (!suffixHex) return baseHex;
  return `${baseHex}${suffixHex.replace(/^0x/, "")}`;
}
