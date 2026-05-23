import Head from 'next/head';
import { useState } from 'react';
import { formatUnits } from 'viem';

import { type BaseFlowMode, type TokenReadiness, useBaseFlow } from '../hooks/useBaseFlow';

type TokenReadinessSnapshot = TokenReadiness & {
  inputKey: string;
};

const sampleRecipients = `0x000000000000000000000000000000000000dEaD 0.001
0x000000000000000000000000000000000000bEEF,0.002`;

export default function Home() {
  const [mode, setMode] = useState<BaseFlowMode>('eth');
  const [recipientBoard, setRecipientBoard] = useState(sampleRecipients);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [approvalSubmitted, setApprovalSubmitted] = useState<string | null>(null);
  const [tokenReadiness, setTokenReadiness] = useState<TokenReadinessSnapshot | null>(null);
  const [tokenCheckError, setTokenCheckError] = useState<string | null>(null);
  const {
    executeGaslessContractCall,
    checkTokenReadiness,
    approveTokenSpend,
    isProcessing,
    isApproving,
    isCheckingToken,
    error,
  } = useBaseFlow();

  const multisenderAddress = process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS;
  const tokenCheckInputKey = createTokenCheckInputKey({ tokenAddress, tokenDecimals, recipientBoard, multisenderAddress });
  const activeTokenReadiness = tokenReadiness?.inputKey === tokenCheckInputKey ? tokenReadiness : null;
  const canCheckToken =
    mode === 'token' &&
    Boolean(multisenderAddress) &&
    tokenAddress.trim().length > 0 &&
    recipientBoard.trim().length > 0 &&
    !isCheckingToken &&
    !isApproving &&
    !isProcessing;
  const canApproveToken =
    Boolean(activeTokenReadiness) &&
    !activeTokenReadiness?.hasEnoughAllowance &&
    !isCheckingToken &&
    !isApproving &&
    !isProcessing;
  const canSubmit =
    Boolean(multisenderAddress) &&
    recipientBoard.trim().length > 0 &&
    !isProcessing &&
    (mode === 'eth' || Boolean(activeTokenReadiness?.isReady));

  async function handleLaunchBatch() {
    setSubmitted(null);

    if (mode === 'token' && !activeTokenReadiness?.isReady) {
      setTokenCheckError('Check token balance and allowance before launching the token batch.');
      return;
    }

    try {
      const result = await executeGaslessContractCall({
        mode,
        recipientBoard,
        tokenAddress: mode === 'token' ? tokenAddress : undefined,
        tokenDecimals,
      });

      setSubmitted(formatSendCallsResult(result));
    } catch {
      // The hook exposes a user-readable error string.
    }
  }

  async function handleCheckToken() {
    setSubmitted(null);
    setApprovalSubmitted(null);
    setTokenCheckError(null);

    try {
      const readiness = await checkTokenReadiness({
        recipientBoard,
        tokenAddress,
        tokenDecimals,
      });

      setTokenReadiness({ ...readiness, inputKey: tokenCheckInputKey });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Token check failed';
      setTokenReadiness(null);
      setTokenCheckError(message);
    }
  }

  async function handleApproveToken() {
    if (!activeTokenReadiness) {
      setTokenCheckError('Run the token check before approving.');
      return;
    }

    setSubmitted(null);
    setApprovalSubmitted(null);
    setTokenCheckError(null);

    try {
      const result = await approveTokenSpend({
        recipientBoard,
        tokenAddress,
        tokenDecimals,
        amount: activeTokenReadiness.requiredAmount,
        currentAllowance: activeTokenReadiness.allowance,
      });

      setApprovalSubmitted(formatSendCallsResult(result));
      setTokenReadiness(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Token approval failed';
      setTokenCheckError(message);
    }
  }

  return (
    <>
      <Head>
        <title>BaseFlow Multisender</title>
        <meta
          name="description"
          content="Gas-sponsored Base multisender powered by a custom contract and CDP Paymaster."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">Base Chain Multisender</p>
          <h1>BaseFlow</h1>
          <p className="lede">
            One contract call. Many recipients. Gas sponsored through your ERC-7677 CDP Paymaster proxy.
          </p>
        </section>

        <section className="workspace-grid">
          <div className="panel board-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recipient Board</p>
                <h2>Paste addresses and amounts</h2>
              </div>
              <div className="mode-switch" aria-label="Transfer mode">
                <button className={mode === 'eth' ? 'active' : ''} type="button" onClick={() => setMode('eth')}>
                  Send ETH
                </button>
                <button className={mode === 'token' ? 'active' : ''} type="button" onClick={() => setMode('token')}>
                  Send Token
                </button>
              </div>
            </div>

            <textarea
              aria-label="Recipient Board"
              value={recipientBoard}
              onChange={(event) => setRecipientBoard(event.target.value)}
              spellCheck={false}
            />
            <p className="hint">Format: one recipient per line, either "address amount" or "address,amount".</p>
          </div>

          <aside className="panel action-panel">
            <p className="eyebrow">Launch Console</p>
            <h2>{mode === 'eth' ? 'ETH batch' : 'Token batch'}</h2>

            {mode === 'token' ? (
              <div className="field-stack">
                <label>
                  Token Contract
                  <input
                    value={tokenAddress}
                    onChange={(event) => setTokenAddress(event.target.value)}
                    placeholder="0xToken..."
                  />
                </label>
                <label>
                  Token Decimals
                  <input
                    min={0}
                    max={255}
                    type="number"
                    value={tokenDecimals}
                    onChange={(event) => setTokenDecimals(Number(event.target.value))}
                  />
                </label>

                <div className="token-actions">
                  <button className="secondary-button" disabled={!canCheckToken} type="button" onClick={handleCheckToken}>
                    {isCheckingToken ? 'Checking...' : 'Check Token'}
                  </button>
                  <button
                    className="approve-button"
                    disabled={!canApproveToken}
                    type="button"
                    onClick={handleApproveToken}
                  >
                    {isApproving ? 'Approving...' : 'Approve Token'}
                  </button>
                </div>

                {activeTokenReadiness ? <TokenReadinessCard readiness={activeTokenReadiness} /> : null}

                {!activeTokenReadiness && !tokenCheckError ? (
                  <p className="hint">Token mode requires the Base Account smart wallet to hold tokens and approve the multisender.</p>
                ) : null}

                {approvalSubmitted ? (
                  <div className="status success compact-status">
                    <strong>Approval submitted</strong>
                    <code>{approvalSubmitted}</code>
                    <span>Wait for confirmation, then run Check Token again.</span>
                  </div>
                ) : null}

                {tokenCheckError ? (
                  <div className="status error compact-status">
                    <strong>Token check failed</strong>
                    <span>{tokenCheckError}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="note">ETH values are sent as msg.value to your BaseFlow multisender contract.</p>
            )}

            <div className="contract-box">
              <span>Multisender</span>
              <code>{multisenderAddress || 'Set NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS'}</code>
            </div>

            <button className="launch-button" disabled={!canSubmit} type="button" onClick={handleLaunchBatch}>
              {getLaunchButtonText({ mode, isProcessing, activeTokenReadiness })}
            </button>

            {submitted ? (
              <div className="status success">
                <strong>Batch submitted</strong>
                <code>{submitted}</code>
              </div>
            ) : null}

            {error ? (
              <div className="status error">
                <strong>Batch failed</strong>
                <span>{error}</span>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </>
  );
}

function TokenReadinessCard({ readiness }: { readiness: TokenReadiness }) {
  const statusText = getReadinessStatusText(readiness);
  const statusClassName = readiness.isReady ? 'ready' : readiness.hasEnoughBalance ? 'warn' : 'bad';

  return (
    <div className="readiness-card">
      <div className={`readiness-banner ${statusClassName}`}>{statusText}</div>
      <dl className="stats-grid">
        <div>
          <dt>Wallet</dt>
          <dd>
            <code>{readiness.owner}</code>
          </dd>
        </div>
        <div>
          <dt>Required</dt>
          <dd>{formatTokenUnits(readiness.requiredAmount, readiness.decimals)}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{formatTokenUnits(readiness.balance, readiness.decimals)}</dd>
        </div>
        <div>
          <dt>Allowance</dt>
          <dd>{formatTokenUnits(readiness.allowance, readiness.decimals)}</dd>
        </div>
      </dl>
    </div>
  );
}

function getLaunchButtonText({
  mode,
  isProcessing,
  activeTokenReadiness,
}: {
  mode: BaseFlowMode;
  isProcessing: boolean;
  activeTokenReadiness: TokenReadinessSnapshot | null;
}) {
  if (isProcessing) {
    return 'Processing Batch...';
  }

  if (mode === 'eth') {
    return 'Launch ETH Batch';
  }

  if (!activeTokenReadiness) {
    return 'Check Token First';
  }

  if (!activeTokenReadiness.isReady) {
    return 'Fix Token Readiness';
  }

  return 'Launch Token Batch';
}

function getReadinessStatusText(readiness: TokenReadiness): string {
  if (!readiness.hasEnoughBalance) {
    return 'Insufficient token balance';
  }

  if (!readiness.hasEnoughAllowance) {
    return 'Approval needed';
  }

  return 'Ready for gasless batch';
}

function formatTokenUnits(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ''] = formatted.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');

  if (!trimmedFraction) {
    return whole;
  }

  return `${whole}.${trimmedFraction.length > 6 ? `${trimmedFraction.slice(0, 6)}...` : trimmedFraction}`;
}

function createTokenCheckInputKey({
  tokenAddress,
  tokenDecimals,
  recipientBoard,
  multisenderAddress,
}: {
  tokenAddress: string;
  tokenDecimals: number;
  recipientBoard: string;
  multisenderAddress: string | undefined;
}): string {
  return [tokenAddress.trim().toLowerCase(), tokenDecimals, recipientBoard, multisenderAddress || ''].join('|');
}

function formatSendCallsResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object' && 'id' in result && typeof result.id === 'string') {
    return result.id;
  }

  return JSON.stringify(result);
}
