"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { WalletModal } from "@/components/WalletModal";
import { AccountModal } from "@/components/AccountModal";
import { getInjectedProvider, getFallbackInjectedProviders, chooseProviderByKey, type RpcProvider, type EIP6963ProviderDetail } from "@/lib/provider";
import { HUB_ABI, ERC20_ABI } from "@/lib/abis";
import { parseCsvToRecipientLines } from "@/lib/csv";

type Mode = "ETH" | "ERC20";
type ParsedRow = { address: string; amountWei: bigint };
type ServerConfig = {
  contract: string;
  chainId: number;
  networkName: string;
  builderCode: string;
  builderSuffix: string;
  hasPaymaster: boolean;
};

const MAX_UI_ROWS = 10000;
const hubIface = new ethers.Interface(HUB_ABI);
const erc20Iface = new ethers.Interface(ERC20_ABI);

function isAddress(value: string) {
  try { return ethers.isAddress(value); } catch { return false; }
}

function appendHexSuffix(baseHex: string, suffixHex: string) {
  if (!suffixHex) return baseHex;
  return `${baseHex}${suffixHex.replace(/^0x/, "")}`;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function makeRandomAmount(min: number, max: number, decimals: number) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const value = Math.random() * (high - low) + low;
  const fixed = value.toFixed(Math.min(decimals, 6));
  return fixed.replace(/\.0+$|0+$/,"").replace(/\.$/,"");
}

function normalizeLines(input: string) {
  return input.replace(/\r/g, "").split("\n").map((v) => v.trim()).filter(Boolean);
}

function parseRecipientText(input: string, decimals: number) {
  const lines = normalizeLines(input);
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  if (lines.length > MAX_UI_ROWS) {
    errors.push(`Max ${MAX_UI_ROWS} rows allowed`);
    return { rows, errors, lineCount: lines.length };
  }

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(",").map((v) => v.trim()).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: amount missing`);
      continue;
    }
    const [address, amountText] = parts;
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
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [mode, setMode] = useState<Mode>("ETH");
  const [input, setInput] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [txHash, setTxHash] = useState("");
  const [address, setAddress] = useState("");
  const [activeProvider, setActiveProvider] = useState<RpcProvider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => { setConfig(cfg); if (cfg?.builderCode) setStatus("Config loaded."); })
      .catch(() => setStatus("Could not load config."));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const discovered = new Map<string, EIP6963ProviderDetail>();

    const addDetail = (detail: EIP6963ProviderDetail) => {
      const key = detail.info.rdns || detail.info.uuid || detail.info.name;
      if (!discovered.has(key)) {
        discovered.set(key, detail);
        setDiscoveredProviders(Array.from(discovered.values()));
      }
    };

    const handleAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (detail?.provider && detail?.info) addDetail(detail);
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    for (const detail of getFallbackInjectedProviders()) addDetail(detail);

    const t = window.setTimeout(() => {
      for (const detail of getFallbackInjectedProviders()) addDetail(detail);
    }, 500);

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
      window.clearTimeout(t);
    };
  }, []);


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
      if (!next) setAccountOpen(false);
    };
    activeProvider.on("accountsChanged", handleAccountsChanged);
    return () => activeProvider.removeListener?.("accountsChanged", handleAccountsChanged);
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
    if (textareaRef.current && gutterRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  }

  async function connectWallet(type: string) {
    try {
      const provider = chooseProviderByKey(type, discoveredProviders);
      if (!provider) {
        alert("Selected wallet is not installed in this browser.");
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
    const provider = activeProvider || getInjectedProvider();
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

  async function approveIfNeeded(provider: RpcProvider, userAddress: string, total: bigint) {
    if (!config) return;
    const browserProvider = new ethers.BrowserProvider(provider as never);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, browserProvider);
    const allowance: bigint = await token.allowance(userAddress, config.contract);
    if (allowance >= total) return;

    const approveData = erc20Iface.encodeFunctionData("approve", [config.contract, total]);
    const tx = await (await browserProvider.getSigner()).sendTransaction({
      to: tokenAddress,
      value: 0n,
      data: config.builderSuffix ? appendHexSuffix(approveData, config.builderSuffix) : approveData,
    });
    setTxHash(tx.hash);
    await tx.wait();
  }

  async function sendTx(provider: RpcProvider, to: string, value: bigint, data: string) {
    const browserProvider = new ethers.BrowserProvider(provider as never);
    const signer = await browserProvider.getSigner();
    const finalData = config?.builderSuffix ? appendHexSuffix(data, config.builderSuffix) : data;
    const tx = await signer.sendTransaction({ to, value, data: finalData });
    setTxHash(tx.hash);
    await tx.wait();
    return tx.hash;
  }

  async function sendEthStrict() {
    if (!config?.contract) {
      alert("Server config missing contract address.");
      return;
    }
    if (!parsed.rows.length || parsed.errors.length) return;

    try {
      setPending(true);
      setStatus("Preparing ETH batch...");
      setTxHash("");
      const { provider } = await ensureWalletConnected();

      for (const rows of chunks) {
        const recipients = rows.map(r => r.address);
        const amounts = rows.map(r => r.amountWei);
        const value = amounts.reduce((a, b) => a + b, 0n);
        const data = hubIface.encodeFunctionData("sendETHStrict", [recipients, amounts]);
        await sendTx(provider, config.contract, value, data);
      }

      setStatus("ETH batch confirmed.");
    } catch (error) {
      console.error(error);
      setStatus("ETH transaction failed or rejected.");
    } finally {
      setPending(false);
    }
  }

  async function sendERC20Strict() {
    if (!config?.contract) {
      alert("Server config missing contract address.");
      return;
    }
    if (!isAddress(tokenAddress)) {
      alert("Enter a valid ERC20 token address.");
      return;
    }
    if (!parsed.rows.length || parsed.errors.length) return;

    try {
      setPending(true);
      setStatus("Preparing token batch...");
      setTxHash("");
      const { provider, address: userAddress } = await ensureWalletConnected();
      await approveIfNeeded(provider, userAddress, totalAmount);

      for (const rows of chunks) {
        const recipients = rows.map(r => r.address);
        const amounts = rows.map(r => r.amountWei);
        const data = hubIface.encodeFunctionData("sendERC20Strict", [tokenAddress, recipients, amounts]);
        await sendTx(provider, config.contract, 0n, data);
      }

      setStatus("Token batch confirmed.");
    } catch (error) {
      console.error(error);
      setStatus("Token transaction failed or rejected.");
    } finally {
      setPending(false);
    }
  }

  async function onUploadCsv(file: File) {
    const text = await file.text();
    const parsedText = parseCsvToRecipientLines(text);
    if (!parsedText) {
      alert("Could not parse any rows from the file.");
      return;
    }
    setInput(parsedText);
  }

  function applyRandomAmounts() {
    const min = Number(minAmount);
    const max = Number(maxAmount);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      alert("Enter valid min and max amounts.");
      return;
    }
    const decimals = mode === "ETH" ? 18 : tokenDecimals;
    const lines = normalizeLines(input);
    if (!lines.length) {
      alert("Paste addresses first.");
      return;
    }
    const next = lines.map((line) => {
      const parts = line.split(",").map((v) => v.trim()).filter(Boolean);
      const maybeAddress = parts[0];
      if (!isAddress(maybeAddress)) return line;
      return `${maybeAddress},${makeRandomAmount(min, max, decimals)}`;
    });
    setInput(next.join("\n"));
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
          <ConnectWalletButton address={address} onOpenConnect={() => setConnectOpen(true)} onOpenAccount={() => setAccountOpen(true)} />
        </section>

        <section className="statGrid">
          <div className="statBox yellow">
            <div className="statNum">{parsed.rows.length}</div>
            <div className="statLabel">VALID ROWS</div>
          </div>
          <div className="statBox lilac">
            <div className="statNum mobileStatNum">{mode === "ETH" ? ethers.formatEther(totalAmount) : ethers.formatUnits(totalAmount, tokenDecimals)}</div>
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
              <button className={`railBtn ${mode === "ETH" ? "active purple" : ""}`} onClick={() => setMode("ETH")}>Send ETH</button>
              <button className={`railBtn ${mode === "ERC20" ? "active cyan" : ""}`} onClick={() => setMode("ERC20")}>Send Token</button>
              <div className="tinyNote">Failed transfer = full revert. No partial send in strict mode.</div>
            </div>
          </aside>

          <section className="editorColumn">
            <div className="panel jumboPanel">
              <div className="panelHeader">
                <div>
                  <div className="panelTitle">Recipient Board</div>
                  <div className="panelSub">Paste addresses or address,amount lines below</div>
                </div>
                <div className="headerActions">
                  <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadCsv(file);
                  }} />
                  <button className="smallAction" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
                </div>
              </div>

              <div className="rangeBar">
                <input className="rangeInput" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min amount" />
                <input className="rangeInput" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max amount" />
                <button className="smallAction altAction" onClick={applyRandomAmounts}>Apply Random</button>
              </div>

              {mode === "ERC20" ? (
                <div className="tokenBar">
                  <input className="tokenInput" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value.trim())} placeholder="ERC20 token address" />
                  <div className="tokenMeta smallTokenMeta">{tokenSymbol} · {tokenDecimals} decimals</div>
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
                  placeholder={`0x1111111111111111111111111111111111111111\n0x2222222222222222222222222222222222222222`}
                />
              </div>
            </div>

            {mode === "ETH" ? (
              <button className="sendAction" onClick={sendEthStrict} disabled={pending || parsed.rows.length === 0 || parsed.errors.length > 0}>{pending ? "Sending..." : "Launch ETH Batch"}</button>
            ) : (
              <button className="sendAction" onClick={sendERC20Strict} disabled={pending || !isAddress(tokenAddress) || parsed.rows.length === 0 || parsed.errors.length > 0}>{pending ? "Sending..." : `Launch ${tokenSymbol} Batch`}</button>
            )}

            <div className="statusTape">{status}{txHash ? ` · ${txHash}` : ""}</div>
          </section>

          <aside className="reviewColumn">
            <div className="panel creamPanel">
              <div className="panelTitle">Dispatch Review</div>
              <div className="reviewList">
                <div className="reviewRow"><span>Network</span><strong>{config?.networkName || "..."}</strong></div>
                <div className="reviewRow"><span>Contract</span><strong>{config?.contract ? `${config.contract.slice(0, 8)}...${config.contract.slice(-4)}` : "..."}</strong></div>
                <div className="reviewRow"><span>Recipients</span><strong>{parsed.rows.length}</strong></div>
                <div className="reviewRow"><span>Total</span><strong>{mode === "ETH" ? `${ethers.formatEther(totalAmount)} ETH` : `${ethers.formatUnits(totalAmount, tokenDecimals)} ${tokenSymbol}`}</strong></div>
                <div className="reviewRow"><span>Mode</span><strong>{mode}</strong></div>
              </div>
              {parsed.errors.length ? (
                <div className="errorStack">{parsed.errors.slice(0, 8).map((item) => <div key={item}>{item}</div>)}</div>
              ) : (
                <div className="successBox">No validation errors.</div>
              )}
            </div>
          </aside>
        </section>

        <WalletModal open={connectOpen} onClose={() => setConnectOpen(false)} onSelect={connectWallet} providers={discoveredProviders} />
        <AccountModal open={accountOpen} address={address} onClose={() => setAccountOpen(false)} onCopy={copyAddress} onDisconnect={disconnectWallet} />
      </div>
    </main>
  );
}
