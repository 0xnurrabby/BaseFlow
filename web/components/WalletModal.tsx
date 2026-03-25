"use client";

import type { EIP6963ProviderDetail } from "@/lib/provider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  providers: EIP6963ProviderDetail[];
};

function iconFor(detail: EIP6963ProviderDetail) {
  const rdns = detail.info.rdns || "";
  const name = detail.info.name || "";
  if (rdns.includes("trustwallet") || name.toLowerCase().includes("trust")) return "🛡";
  if (rdns.includes("metamask") || name.toLowerCase().includes("metamask")) return "🦊";
  if (rdns.includes("rabby") || name.toLowerCase().includes("rabby")) return "🐰";
  return "◼";
}

const popular = [
  { key: "rainbow", title: "Rainbow" },
  { key: "base", title: "Base Account" },
  { key: "walletconnect", title: "WalletConnect" },
];

export function WalletModal({ open, onClose, onSelect, providers }: Props) {
  if (!open) return null;

  return (
    <div className="overlay">
      <div className="walletModal">
        <div className="walletModalLeft">
          <div className="walletModalHead">
            <h3>Connect a Wallet</h3>
            <button className="iconClose" onClick={onClose}>×</button>
          </div>

          {providers.length ? <div className="walletGroupTitle">Installed</div> : null}
          <div className="walletList">
            {providers.map((item) => (
              <button key={item.info.uuid} className="walletOption" onClick={() => onSelect(item.info.rdns || item.info.uuid)}>
                <div className="walletIcon">{iconFor(item)}</div>
                <div>
                  <div className="walletName">{item.info.name}</div>
                  <div className="walletSub">Installed</div>
                </div>
              </button>
            ))}
          </div>

          <div className="walletGroupTitle">Popular</div>
          <div className="walletList">
            {popular.map((item) => (
              <button key={item.key} className="walletOption disabledOption" onClick={() => onSelect(item.key)}>
                <div className="walletIcon">◼</div>
                <div>
                  <div className="walletName">{item.title}</div>
                  <div className="walletSub">Not installed</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="walletModalRight">
          <h3>What is a Wallet?</h3>
          <div className="walletExplainBlock">
            <div className="walletExplainIcon">🧩</div>
            <div>
              <div className="walletExplainTitle">A Home for your Digital Assets</div>
              <div className="walletExplainText">Wallets are used to send, receive, store, and display digital assets like ETH and tokens.</div>
            </div>
          </div>
          <div className="walletExplainBlock">
            <div className="walletExplainIcon">🔐</div>
            <div>
              <div className="walletExplainTitle">A New Way to Log In</div>
              <div className="walletExplainText">Instead of passwords on every site, you can connect a wallet and approve actions directly.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
