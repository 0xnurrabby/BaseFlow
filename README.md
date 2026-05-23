# BaseFlow

BaseFlow is a Next.js/React multisender for Base that sends one `wallet_sendCalls` request to a custom multisender contract and sponsors gas through an ERC-7677 CDP Paymaster proxy.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `CDP_PAYMASTER_URL`.
3. Deploy `contracts/BaseFlowMultisender.sol`.
4. Set `MULTISENDER_CONTRACT_ADDRESS` and `NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS` to the deployed address. Current Base deployment: `0x136cc543E5ae13DFdc27c651E9357066cC7365cf`.
5. In CDP Paymaster, allowlist the multisender contract and the `multisendETH` and `multisendToken` functions.
6. Run `npm run dev`.

## Recipient Board Format

Use one recipient per line:

```txt
0xRecipientAddress 0.01
0xRecipientAddress,0.02
```

Token mode uses `tokenDecimals` to parse amounts and requires prior ERC20 allowance for the multisender contract.
The UI includes a token readiness check for the connected Base Account smart wallet and an approval transaction button when allowance is too low.
