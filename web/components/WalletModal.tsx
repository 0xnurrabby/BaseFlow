"use client";
type Props = { open: boolean; onClose: () => void; onSelect: (key: string) => void; hasMetaMask: boolean; hasRabby: boolean; };
export function WalletModal({ open, onClose, onSelect, hasMetaMask, hasRabby }: Props) {
  if (!open) return null;
  const installed = [
    ...(hasMetaMask ? [{ key: "metamask", title: "MetaMask", icon: "🦊" }] : []),
    ...(hasRabby ? [{ key: "rabby", title: "Rabby Wallet", icon: "🐰" }] : []),
  ];
  const popular = [{ key: "rainbow", title: "Rainbow" }, { key: "base", title: "Base Account" }, { key: "walletconnect", title: "WalletConnect" }];
  return (
    <div className="overlay">
      <div className="walletModal">
        <div className="walletModalLeft">
          <div className="walletModalHead"><h3>Connect a Wallet</h3><button className="iconClose" onClick={onClose}>×</button></div>
          {installed.length ? <div className="walletGroupTitle">Installed</div> : null}
          <div className="walletList">
            {installed.map((item) => (
              <button key={item.key} className="walletOption" onClick={() => onSelect(item.key)}>
                <div className="walletIcon">{item.icon}</div>
                <div><div className="walletName">{item.title}</div><div className="walletSub">Installed</div></div>
              </button>
            ))}
          </div>
          <div className="walletGroupTitle">Popular</div>
          <div className="walletList">
            {popular.map((item) => (
              <button key={item.key} className="walletOption disabledOption" onClick={() => onSelect(item.key)}>
                <div className="walletIcon">◼</div>
                <div><div className="walletName">{item.title}</div><div className="walletSub">Not installed</div></div>
              </button>
            ))}
          </div>
        </div>
        <div className="walletModalRight">
          <h3>What is a Wallet?</h3>
          <div className="walletExplainBlock">
            <div className="walletExplainIcon">🧩</div>
            <div><div className="walletExplainTitle">A Home for your Digital Assets</div><div className="walletExplainText">Wallets are used to send, receive, store, and display digital assets like ETH and tokens.</div></div>
          </div>
          <div className="walletExplainBlock">
            <div className="walletExplainIcon">🔐</div>
            <div><div className="walletExplainTitle">A New Way to Log In</div><div className="walletExplainText">Instead of passwords on every site, you can connect a wallet and approve actions directly.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
