import Head from 'next/head';
import { useState } from 'react';

import { type BaseFlowMode, useBaseFlow } from '../hooks/useBaseFlow';

const sampleRecipients = `0x000000000000000000000000000000000000dEaD 0.001
0x000000000000000000000000000000000000bEEF,0.002`;

export default function Home() {
  const [mode, setMode] = useState<BaseFlowMode>('eth');
  const [recipientBoard, setRecipientBoard] = useState(sampleRecipients);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { executeGaslessContractCall, isProcessing, error } = useBaseFlow();

  const multisenderAddress = process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS;
  const canSubmit =
    Boolean(multisenderAddress) &&
    recipientBoard.trim().length > 0 &&
    !isProcessing &&
    (mode === 'eth' || tokenAddress.trim().length > 0);

  async function handleLaunchBatch() {
    setSubmitted(null);

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
                <p className="hint">Token mode requires the user to approve the multisender contract first.</p>
              </div>
            ) : (
              <p className="note">ETH values are sent as msg.value to your BaseFlow multisender contract.</p>
            )}

            <div className="contract-box">
              <span>Multisender</span>
              <code>{multisenderAddress || 'Set NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS'}</code>
            </div>

            <button className="launch-button" disabled={!canSubmit} type="button" onClick={handleLaunchBatch}>
              {isProcessing ? 'Processing Batch...' : mode === 'eth' ? 'Launch ETH Batch' : 'Launch Token Batch'}
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

function formatSendCallsResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object' && 'id' in result && typeof result.id === 'string') {
    return result.id;
  }

  return JSON.stringify(result);
}
