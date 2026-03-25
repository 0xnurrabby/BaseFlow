"use client";

type WalletOption = {
  key: string;
  title: string;
  subtitle?: string;
  installed?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  hasMetaMask: boolean;
  hasRabby: boolean;
};

const popularOptions: WalletOption[] = [
  { key: "rainbow", title: "Rainbow" },
  { key: "base", title: "Base Account" },
  { key: "walletconnect", title: "WalletConnect" },
];

export function WalletModal({ open, onClose, onSelect, hasMetaMask, hasRabby }: Props) {
  if (!open) return null;

  const installed: WalletOption[] = [
    ...(hasMetaMask ? [{ key: "metamask", title: "MetaMask", subtitle: "Installed", installed: true }] : []),
    ...(hasRabby ? [{ key: "rabby", title: "Rabby Wallet", subtitle: "Installed", installed: true }] : []),
  ];

  return (
    <div className="overlay">
      <div className="walletModal">
        <div className="walletModalLeft">
          <div className="walletModalHead">
            <h3>Connect a Wallet</h3>
            <button className="iconClose" onClick={onClose}>×</button>
          </div>

          {installed.length ? (
            <>
              <div className="walletGroupTitle">Installed</div>
              <div className="walletList">
                {installed.map((item) => (
                  <button key={item.key} className="walletOption" onClick={() => onSelect(item.key)}>
                    <div className="walletIcon">{item.key === "metamask" ? "🦊" : "🐰"}</div>
                    <div className="walletInfo">
                      <div className="walletName">{item.title}</div>
                      <div className="walletSub">{item.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="walletGroupTitle">Popular</div>
          <div className="walletList">
            {popularOptions.map((item) => (
              <button
                key={item.key}
                className="walletOption disabledOption"
                onClick={() => onSelect(item.key)}
              >
                <div className="walletIcon">◼</div>
                <div className="walletInfo">
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
              <div className="walletExplainText">Instead of creating site-specific passwords, you can connect a wallet and sign transactions directly.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
