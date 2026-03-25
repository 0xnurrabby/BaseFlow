"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { WalletModal } from "@/components/WalletModal";
import { AccountModal } from "@/components/AccountModal";
import { getInjectedProvider, getProviderByName, type RpcProvider } from "@/lib/provider";
import { appendHexSuffix, getBuilderSuffix } from "@/lib/builder";
import { ERC20_ABI, HUB_ABI } from "@/lib/abis";
import { parseCsvToRecipientLines } from "@/lib/csv";

type Mode = "ETH" | "ERC20";
type ParsedRow = { address: string; amountWei: bigint };
type Capabilities = Record<string, {
  dataSuffix?: { supported?: boolean };
  paymasterService?: { supported?: boolean };
}>;

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BASEFLOW_CONTRACT || "0x1111111111111111111111111111111111111111";
const CHAIN_ID_NUM = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
const CHAIN_ID_HEX = `0x${CHAIN_ID_NUM.toString(16)}`;
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || "Base Mainnet";
const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE || "";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
const MAX_UI_ROWS = 10000;

const hubIface = new ethers.Interface(HUB_ABI);
const erc20Iface = new ethers.Interface(ERC20_ABI);

function isAddress(value: string) {
  try { return ethers.isAddress(value); } catch { return false; }
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function parseRecipientText(input: string, decimals: number) {
  const lines = input.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  if (lines.length > MAX_UI_ROWS) {
    errors.push(`Max ${MAX_UI_ROWS} rows allowed`);
    return { rows, errors, lineCount: lines.length };
  }

  for (let i = 0; i < lines.length; i++) {
    const [address, amountText] = lines[i].split(",").map(v => v?.trim());
    if (!address || !amountText) {
      errors.push(`Line ${i + 1}: use address,amount`);
      continue;
    }
    if (!isAddress(address)) {
      errors.push(`Line ${i + 1}: invalid address`);
      continue;
    }
    try {
      const amountWei = ethers.parseUnits(amountText, decimals);
      if (amountWei <= 0n) {
        errors.push(`Line ${i + 1}: amount must be > 0`);
        continue;
      }
      rows.push({ address, amountWei });
    } catch {
      errors.push(`Line ${i + 1}: invalid amount`);
    }
  }

  return { rows, errors, lineCount: lines.length };
}

function numberText(count: number) {
  return Array.from({ length: Math.max(count, 12) }, (_, i) => String(i + 1)).join("\n");
}

export function AppShell() {
  const [mode, setMode] = useState<Mode>("ETH");
  const [input, setInput] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [txHash, setTxHash] = useState("");
  const [lastPath, setLastPath] = useState("none");
  const [address, setAddress] = useState("");
  const [activeProvider, setActiveProvider] = useState<RpcProvider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const injected = getInjectedProvider();
  const hasMetaMask = !!getProviderByName("metamask");
  const hasRabby = !!getProviderByName("rabby");

  const builderSuffix = useMemo(() => getBuilderSuffix(BUILDER_CODE), []);
  const parsed = useMemo(
    () => parseRecipientText(input, mode === "ETH" ? 18 : tokenDecimals),
    [input, mode, tokenDecimals]
  );
  const totalAmount = useMemo(() => parsed.rows.reduce((a, r) => a + r.amountWei, 0n), [parsed.rows]);
  const chunks = useMemo(() => chunk(parsed.rows, 500), [parsed.rows]);
  const lineNumbers = useMemo(() => numberText(parsed.lineCount), [parsed.lineCount]);

  useEffect(() => {
    if (!activeProvider?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const next = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      setAddress(next);
      if (!next) {
        setAccountOpen(false);
      }
    };

    activeProvider.on("accountsChanged", handleAccountsChanged);
    return () => {
      activeProvider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [activeProvider]);

  useEffect(() => {
    async function loadTokenMeta() {
      if (mode !== "ERC20" || !isAddress(tokenAddress) || !activeProvider) return;
      try {
        const browserProvider = new ethers.BrowserProvider(activeProvider as never);
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, browserProvider);
        const [decimals, symbol] = await Promise.all([
          token.decimals().catch(() => 18),
          token.symbol().catch(() => "TOKEN"),
        ]);
        setTokenDecimals(Number(decimals));
        setTokenSymbol(String(symbol));
      } catch {}
    }
    loadTokenMeta();
  }, [tokenAddress, mode, activeProvider]);

  function syncScroll() {
    if (!textareaRef.current || !gutterRef.current) return;
    gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  }

  async function connectWallet(type: string) {
    try {
      let provider: RpcProvider | null = null;

      if (type === "metamask") provider = getProviderByName("metamask");
      else if (type === "rabby") provider = getProviderByName("rabby");
      else {
        alert("This wallet option is not installed on your browser right now.");
        return;
      }

      if (!provider) {
        alert("Selected wallet is not installed.");
        return;
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const list = Array.isArray(accounts) ? accounts : [];
      const nextAddress = typeof list[0] === "string" ? list[0] : "";

      if (nextAddress) {
        setActiveProvider(provider);
        setAddress(nextAddress);
        setConnectOpen(false);
      }
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed or was cancelled.");
    }
  }

  async function getConnectedAddress(provider: RpcProvider) {
    const accounts = await provider.request({ method: "eth_accounts" });
    const list = Array.isArray(accounts) ? accounts : [];
    return typeof list[0] === "string" ? list[0] : "";
  }

  async function ensureWalletConnected() {
    const provider = activeProvider || injected;
    if (!provider) throw new Error("No wallet provider");
    let nextAddress = await getConnectedAddress(provider);
    if (!nextAddress) {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const list = Array.isArray(accounts) ? accounts : [];
      nextAddress = typeof list[0] === "string" ? list[0] : "";
    }
    if (!nextAddress) throw new Error("Wallet not connected");

    setActiveProvider(provider);
    setAddress(nextAddress);
    return { provider, address: nextAddress };
  }

  async function getCapabilities(provider: RpcProvider, userAddress: string): Promise<Capabilities> {
    try {
      return (await provider.request({ method: "wallet_getCapabilities", params: [userAddress] })) || {};
    } catch {
      return {};
    }
  }

  async function sendCallsSponsored(provider: RpcProvider, userAddress: string, calls: Array<{to: string; value: string; data: string;}>) {
    const capabilities = await getCapabilities(provider, userAddress);
    const dataSuffixSupported = !!capabilities[CHAIN_ID_HEX]?.dataSuffix?.supported;
    const paymasterSupported = !!capabilities[CHAIN_ID_HEX]?.paymasterService?.supported;

    if (!PAYMASTER_URL || !paymasterSupported) {
      throw new Error("Sponsored flow unavailable");
    }

    const caps: Record<string, any> = {
      paymasterService: { url: PAYMASTER_URL }
    };

    if (builderSuffix && dataSuffixSupported) {
      caps.dataSuffix = { value: builderSuffix, optional: true };
    }

    const result = await provider.request({
      method: "wallet_sendCalls",
      params: [{
        version: "1.0",
        chainId: CHAIN_ID_HEX,
        from: userAddress,
        calls,
        capabilities: caps,
      }],
    });

    return result;
  }

  async function fallbackTx(provider: RpcProvider, to: string, value: bigint, data: string) {
    const browserProvider = new ethers.BrowserProvider(provider as never);
    const signer = await browserProvider.getSigner();
    const finalData = builderSuffix ? appendHexSuffix(data, builderSuffix) : data;
    const tx = await signer.sendTransaction({ to, value, data: finalData });
    setTxHash(tx.hash);
    await tx.wait();
    return tx.hash;
  }

  async function approveIfNeeded(provider: RpcProvider, userAddress: string, total: bigint) {
    const browserProvider = new ethers.BrowserProvider(provider as never);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, browserProvider);
    const allowance: bigint = await token.allowance(userAddress, CONTRACT_ADDRESS);

    if (allowance >= total) return;

    const approveData = erc20Iface.encodeFunctionData("approve", [CONTRACT_ADDRESS, total]);

    try {
      const result = await sendCallsSponsored(provider, userAddress, [{
        to: tokenAddress,
        value: "0x0",
        data: approveData,
      }]);
      setLastPath("sponsored");
      if (result?.id) setTxHash(String(result.id));
    } catch {
      setLastPath("fallback");
      await fallbackTx(provider, tokenAddress, 0n, approveData);
    }
  }

  async function sendEthStrict() {
    if (CONTRACT_ADDRESS === "0x1111111111111111111111111111111111111111") {
      alert("Set NEXT_PUBLIC_BASEFLOW_CONTRACT in .env.local first.");
      return;
    }
    if (!parsed.rows.length || parsed.errors.length) return;

    try {
      setPending(true);
      setStatus("Preparing ETH batch...");
      setTxHash("");
      setLastPath("none");

      const { provider, address: userAddress } = await ensureWalletConnected();

      for (const rows of chunks) {
        const recipients = rows.map(r => r.address);
        const amounts = rows.map(r => r.amountWei);
        const value = amounts.reduce((a, b) => a + b, 0n);
        const data = hubIface.encodeFunctionData("sendETHStrict", [recipients, amounts]);

        try {
          setStatus("Trying sponsored ETH path...");
          const result = await sendCallsSponsored(provider, userAddress, [{
            to: CONTRACT_ADDRESS,
            value: `0x${value.toString(16)}`,
            data,
          }]);
          setLastPath("sponsored");
          setStatus("Sponsored ETH request submitted.");
          if (result?.id) setTxHash(String(result.id));
        } catch {
          setStatus("Falling back to direct ETH transaction...");
          const hash = await fallbackTx(provider, CONTRACT_ADDRESS, value, data);
          setLastPath("fallback");
          setStatus("ETH batch confirmed.");
          setTxHash(hash);
        }
      }
    } catch (error) {
      console.error(error);
      setStatus("ETH transaction failed or rejected.");
    } finally {
      setPending(false);
    }
  }

  async function sendERC20Strict() {
    if (!isAddress(tokenAddress)) {
      alert("Enter a valid ERC20 token address.");
      return;
    }
    if (CONTRACT_ADDRESS === "0x1111111111111111111111111111111111111111") {
      alert("Set NEXT_PUBLIC_BASEFLOW_CONTRACT in .env.local first.");
      return;
    }
    if (!parsed.rows.length || parsed.errors.length) return;

    try {
      setPending(true);
      setStatus("Preparing ERC20 batch...");
      setTxHash("");
      setLastPath("none");

      const { provider, address: userAddress } = await ensureWalletConnected();
      await approveIfNeeded(provider, userAddress, totalAmount);

      for (const rows of chunks) {
        const recipients = rows.map(r => r.address);
        const amounts = rows.map(r => r.amountWei);
        const data = hubIface.encodeFunctionData("sendERC20Strict", [tokenAddress, recipients, amounts]);

        try {
          setStatus("Trying sponsored ERC20 path...");
          const result = await sendCallsSponsored(provider, userAddress, [{
            to: CONTRACT_ADDRESS,
            value: "0x0",
            data,
          }]);
          setLastPath("sponsored");
          setStatus("Sponsored ERC20 request submitted.");
          if (result?.id) setTxHash(String(result.id));
        } catch {
          setStatus("Falling back to direct ERC20 batch transaction...");
          const hash = await fallbackTx(provider, CONTRACT_ADDRESS, 0n, data);
          setLastPath("fallback");
          setStatus("ERC20 batch confirmed.");
          setTxHash(hash);
        }
      }
    } catch (error) {
      console.error(error);
      setStatus("ERC20 transaction failed or rejected.");
    } finally {
      setPending(false);
    }
  }

  async function onUploadCsv(file: File) {
    const text = await file.text();
    const parsedText = parseCsvToRecipientLines(text);
    if (!parsedText) {
      alert("Could not parse any address,amount pairs from the file.");
      return;
    }
    setInput(parsedText);
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setStatus("Address copied.");
    setAccountOpen(false);
  }

  function disconnectWallet() {
    setAddress("");
    setActiveProvider(null);
    setAccountOpen(false);
    setStatus("Wallet disconnected locally.");
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="topBar">
          <div className="brandTitle">BaseFlow</div>
          <ConnectWalletButton
            address={address}
            onOpenConnect={() => setConnectOpen(true)}
            onOpenAccount={() => setAccountOpen(true)}
          />
        </section>

        <section className="statGrid">
          <div className="statBox yellow">
            <div className="statNum">{parsed.rows.length}</div>
            <div className="statLabel">VALID ROWS</div>
          </div>
          <div className="statBox lilac">
            <div className="statNum">
              {mode === "ETH" ? ethers.formatEther(totalAmount) : ethers.formatUnits(totalAmount, tokenDecimals)}
            </div>
            <div className="statLabel">{mode === "ETH" ? "TOTAL ETH" : `TOTAL ${tokenSymbol}`}</div>
          </div>
          <div className="statBox mint">
            <div className="statNum">{parsed.errors.length}</div>
            <div className="statLabel">ISSUES</div>
          </div>
        </section>

        <section className="contentGrid">
          <aside className="leftRail">
            <div className="panel modePanel">
              <div className="panelTitle">Modes</div>
              <button className={`railBtn ${mode === "ETH" ? "active purple" : ""}`} onClick={() => setMode("ETH")}>ETH Strict</button>
              <button className={`railBtn ${mode === "ERC20" ? "active cyan" : ""}`} onClick={() => setMode("ERC20")}>ERC20 Complete</button>
              <div className="tinyNote">Failed transfer = full revert. No partial send in strict mode.</div>
            </div>
          </aside>

          <section className="editorColumn">
            <div className="panel jumboPanel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Recipient Board</div>
                  <div className="panelSub">Paste your batch list below</div>
                </div>
                <div className="headerActions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadCsv(file);
                    }}
                  />
                  <button className="smallAction" onClick={() => fileInputRef.current?.click()}>
                    Upload CSV
                  </button>
                </div>
              </div>

              {mode === "ERC20" ? (
                <div className="tokenBar">
                  <input
                    className="tokenInput"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value.trim())}
                    placeholder="ERC20 token address"
                  />
                  <div className="tokenMeta">{tokenSymbol} · {tokenDecimals} decimals</div>
                </div>
              ) : null}

              <div className="editorFrame">
                <pre ref={gutterRef} className="lineCol">{lineNumbers}</pre>
                <textarea
                  ref={textareaRef}
                  className="editorArea"
                  spellCheck={false}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onScroll={syncScroll}
                  placeholder={`0x1111111111111111111111111111111111111111,0.01\n0x2222222222222222222222222222222222222222,0.02`}
                />
              </div>
            </div>

            {mode === "ETH" ? (
              <button className="sendAction" onClick={sendEthStrict} disabled={pending || parsed.rows.length === 0 || parsed.errors.length > 0}>
                {pending ? "Sending..." : "Launch ETH Batch"}
              </button>
            ) : (
              <button className="sendAction" onClick={sendERC20Strict} disabled={pending || !isAddress(tokenAddress) || parsed.rows.length === 0 || parsed.errors.length > 0}>
                {pending ? "Sending..." : `Launch ${tokenSymbol} Batch`}
              </button>
            )}

            <div className="statusTape">{status}{txHash ? ` · ${txHash}` : ""}</div>
          </section>

          <aside className="reviewColumn">
            <div className="panel creamPanel">
              <div className="panelTitle">Dispatch Review</div>
              <div className="reviewList">
                <div className="reviewRow"><span>Network</span><strong>{NETWORK_NAME}</strong></div>
                <div className="reviewRow"><span>Contract</span><strong>{CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-4)}</strong></div>
                <div className="reviewRow"><span>Recipients</span><strong>{parsed.rows.length}</strong></div>
                <div className="reviewRow"><span>Total</span><strong>{mode === "ETH" ? `${ethers.formatEther(totalAmount)} ETH` : `${ethers.formatUnits(totalAmount, tokenDecimals)} ${tokenSymbol}`}</strong></div>
                <div className="reviewRow"><span>Mode</span><strong>{mode}</strong></div>
                <div className="reviewRow"><span>Path</span><strong>{lastPath}</strong></div>
              </div>

              {parsed.errors.length ? (
                <div className="errorStack">
                  {parsed.errors.slice(0, 8).map((item) => <div key={item}>{item}</div>)}
                </div>
              ) : (
                <div className="successBox">No validation errors.</div>
              )}
            </div>
          </aside>
        </section>

        <WalletModal
          open={connectOpen}
          onClose={() => setConnectOpen(false)}
          onSelect={connectWallet}
          hasMetaMask={hasMetaMask}
          hasRabby={hasRabby}
        />

        <AccountModal
          open={accountOpen}
          address={address}
          onClose={() => setAccountOpen(false)}
          onCopy={copyAddress}
          onDisconnect={disconnectWallet}
        />
      </div>
    </main>
  );
}
