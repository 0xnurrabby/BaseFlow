"use client";

export type RpcProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  providers?: RpcProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
};

export type EIP6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: RpcProvider;
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

export function getFallbackInjectedProviders(): EIP6963ProviderDetail[] {
  const provider = getInjectedProvider();
  if (!provider) return [];

  const candidates = Array.isArray(provider.providers) && provider.providers.length
    ? provider.providers
    : [provider];

  const out: EIP6963ProviderDetail[] = [];
  const seen = new Set<string>();

  for (const p of candidates) {
    let name = "Browser Wallet";
    let rdns = "injected.browserwallet";

    if (p.isTrust) {
      name = "Trust Wallet";
      rdns = "com.trustwallet.app";
    } else if (p.isRabby) {
      name = "Rabby Wallet";
      rdns = "io.rabby";
    } else if (p.isMetaMask) {
      name = "MetaMask";
      rdns = "io.metamask";
    }

    if (!seen.has(rdns)) {
      seen.add(rdns);
      out.push({
        info: {
          uuid: rdns,
          name,
          icon: "",
          rdns,
        },
        provider: p,
      });
    }
  }

  return out;
}

export function chooseProviderByKey(key: string, providers: EIP6963ProviderDetail[]): RpcProvider | null {
  const found = providers.find((p) => p.info.rdns === key || p.info.uuid === key || p.info.name === key);
  return found?.provider ?? null;
}
