"use client";

export type RpcProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  providers?: RpcProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
};

declare global {
  interface Window {
    ethereum?: RpcProvider;
  }
}

export function getInjectedProvider(): RpcProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function getProviderByName(name: "metamask" | "rabby"): RpcProvider | null {
  const provider = getInjectedProvider();
  if (!provider) return null;

  const candidates = Array.isArray(provider.providers) && provider.providers.length
    ? provider.providers
    : [provider];

  if (name === "metamask") {
    return candidates.find((p) => !!p.isMetaMask) || null;
  }

  if (name === "rabby") {
    return candidates.find((p) => !!p.isRabby) || null;
  }

  return null;
}
