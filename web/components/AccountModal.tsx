"use client";
type Props = { open: boolean; address: string; onClose: () => void; onCopy: () => void; onDisconnect: () => void; };
export function AccountModal({ open, address, onClose, onCopy, onDisconnect }: Props) {
  if (!open || !address) return null;
  return (
    <div className="overlay">
      <div className="accountModal">
        <button className="iconClose floatingClose" onClick={onClose}>×</button>
        <div className="accountAvatar">🧩</div>
        <div className="accountAddress">{address.slice(0, 6)}...{address.slice(-4)}</div>
        <div className="accountSub">Connected wallet</div>
        <div className="accountActions">
          <button className="accountActionBtn" onClick={onCopy}>Copy Address</button>
          <button className="accountActionBtn" onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>
    </div>
  );
}
