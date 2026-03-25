"use client";

type Props = {
  address: string;
  onOpenConnect: () => void;
  onOpenAccount: () => void;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton({ address, onOpenConnect, onOpenAccount }: Props) {
  if (address) {
    return (
      <button className="walletBtn connected" onClick={onOpenAccount}>
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button className="walletBtn" onClick={onOpenConnect}>
      Connect Wallet
    </button>
  );
}
