import { createBaseAccountSDK, getCryptoKeyAccount, base as baseAccount } from '@base-org/account';
import { useState } from 'react';
import {
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  numberToHex,
  parseEther,
  parseUnits,
} from 'viem';
import { base as baseChain, baseSepolia } from 'viem/chains';

export type BaseFlowMode = 'eth' | 'token';

export type ParsedRecipient = {
  lineNumber: number;
  recipient: Address;
  amount: bigint;
  amountText: string;
};

export type ExecuteGaslessContractCallArgs = {
  mode: BaseFlowMode;
  recipientBoard: string;
  tokenAddress?: Address | string;
  tokenDecimals?: number;
  multisenderAddress?: Address | string;
  paymasterProxyUrl?: string;
  chainId?: number;
};

export type TokenReadinessArgs = {
  recipientBoard: string;
  tokenAddress: Address | string;
  tokenDecimals?: number;
  owner?: Address | string;
  multisenderAddress?: Address | string;
  chainId?: number;
};

export type TokenReadiness = {
  owner: Address;
  tokenAddress: Address;
  multisenderAddress: Address;
  decimals: number;
  recipientCount: number;
  requiredAmount: bigint;
  balance: bigint;
  allowance: bigint;
  hasEnoughBalance: boolean;
  hasEnoughAllowance: boolean;
  isReady: boolean;
};

export type ApproveTokenSpendArgs = Omit<TokenReadinessArgs, 'owner'> & {
  amount?: bigint;
  currentAllowance?: bigint;
};

export type WalletSendCallsResult = string | { id?: string; [key: string]: unknown };

type Eip1193Provider = {
  request<TResponse = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<TResponse>;
};

type MultisendCall = {
  to: Address;
  value: Hex;
  data: Hex;
};

export const baseFlowMultisenderAbi = [
  {
    type: 'function',
    name: 'multisendETH',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multisendToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const;

export const baseFlowErc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

export function useBaseFlow() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WalletSendCallsResult | null>(null);

  async function executeGaslessContractCall(args: ExecuteGaslessContractCallArgs): Promise<WalletSendCallsResult> {
    setIsProcessing(true);
    setError(null);

    try {
      const chainId = resolveChainId(args.chainId);
      const provider = createBaseFlowProvider(chainId);
      const from = await getConnectedBaseAccount(provider);
      const paymasterUrl = resolvePaymasterUrl(args.paymasterProxyUrl);
      const call = buildMultisendCall(args);

      const result = await provider.request<WalletSendCallsResult>({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '1.0',
            chainId: numberToHex(chainId),
            from,
            calls: [call],
            capabilities: {
              paymasterService: {
                url: paymasterUrl,
              },
            },
          },
        ],
      });

      setLastResult(result);
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Gasless BaseFlow batch failed';
      setError(message);
      throw caught;
    } finally {
      setIsProcessing(false);
    }
  }

  async function checkTokenReadiness(args: TokenReadinessArgs): Promise<TokenReadiness> {
    setIsCheckingToken(true);
    setError(null);

    try {
      const chainId = resolveChainId(args.chainId);
      const provider = createBaseFlowProvider(chainId);
      const owner = args.owner ? resolveAddress(args.owner, 'owner') : await getConnectedBaseAccount(provider);
      const tokenAddress = resolveAddress(args.tokenAddress, 'tokenAddress');
      const multisenderAddress = resolveAddress(
        args.multisenderAddress || process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS,
        'NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS',
      );
      const decimals = validateDecimals(args.tokenDecimals ?? 18);
      const parsedRecipients = parseRecipientBoard(args.recipientBoard, decimals);
      const requiredAmount = sumRecipientAmounts(parsedRecipients);
      const publicClient = createBaseFlowPublicClient(chainId);

      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: baseFlowErc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: baseFlowErc20Abi,
          functionName: 'allowance',
          args: [owner, multisenderAddress],
        }),
      ]);

      const hasEnoughBalance = balance >= requiredAmount;
      const hasEnoughAllowance = allowance >= requiredAmount;

      return {
        owner,
        tokenAddress,
        multisenderAddress,
        decimals,
        recipientCount: parsedRecipients.length,
        requiredAmount,
        balance,
        allowance,
        hasEnoughBalance,
        hasEnoughAllowance,
        isReady: hasEnoughBalance && hasEnoughAllowance,
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Token balance and allowance check failed';
      setError(message);
      throw caught;
    } finally {
      setIsCheckingToken(false);
    }
  }

  async function approveTokenSpend(args: ApproveTokenSpendArgs): Promise<WalletSendCallsResult> {
    setIsApproving(true);
    setError(null);

    try {
      const chainId = resolveChainId(args.chainId);
      const provider = createBaseFlowProvider(chainId);
      const from = await getConnectedBaseAccount(provider);
      const tokenAddress = resolveAddress(args.tokenAddress, 'tokenAddress');
      const multisenderAddress = resolveAddress(
        args.multisenderAddress || process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS,
        'NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS',
      );
      const decimals = validateDecimals(args.tokenDecimals ?? 18);
      const amount = args.amount ?? sumRecipientAmounts(parseRecipientBoard(args.recipientBoard, decimals));

      if (amount <= 0n) {
        throw new Error('Approval amount must be greater than zero');
      }

      const approvalCalls = [
        ...(args.currentAllowance && args.currentAllowance > 0n
          ? [buildApprovalCall(tokenAddress, multisenderAddress, 0n)]
          : []),
        buildApprovalCall(tokenAddress, multisenderAddress, amount),
      ];

      const result = await provider.request<WalletSendCallsResult>({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '1.0',
            chainId: numberToHex(chainId),
            from,
            calls: approvalCalls,
          },
        ],
      });

      setLastResult(result);
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Token approval failed';
      setError(message);
      throw caught;
    } finally {
      setIsApproving(false);
    }
  }

  return {
    executeGaslessContractCall,
    checkTokenReadiness,
    approveTokenSpend,
    isProcessing,
    isApproving,
    isCheckingToken,
    error,
    lastResult,
  };
}

export function buildMultisendCall(args: ExecuteGaslessContractCallArgs): MultisendCall {
  const multisenderAddress = resolveAddress(
    args.multisenderAddress || process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS,
    'NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS',
  );
  const decimals = args.mode === 'eth' ? 18 : validateDecimals(args.tokenDecimals ?? 18);
  const parsedRecipients = parseRecipientBoard(args.recipientBoard, decimals);
  const recipients = parsedRecipients.map((item) => item.recipient);
  const amounts = parsedRecipients.map((item) => item.amount);
  const totalAmount = sumRecipientAmounts(parsedRecipients);

  if (args.mode === 'eth') {
    return {
      to: multisenderAddress,
      value: numberToHex(totalAmount),
      data: encodeFunctionData({
        abi: baseFlowMultisenderAbi,
        functionName: 'multisendETH',
        args: [recipients, amounts],
      }),
    };
  }

  const tokenAddress = resolveAddress(args.tokenAddress, 'tokenAddress');

  return {
    to: multisenderAddress,
    value: '0x0',
    data: encodeFunctionData({
      abi: baseFlowMultisenderAbi,
      functionName: 'multisendToken',
      args: [tokenAddress, recipients, amounts],
    }),
  };
}

export function parseRecipientBoard(input: string, decimals = 18): ParsedRecipient[] {
  validateDecimals(decimals);

  const rows = input
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line.split('#')[0]?.trim() ?? '' }))
    .filter((row) => row.text.length > 0);

  if (rows.length === 0) {
    throw new Error('Recipient Board is empty');
  }

  return rows.map(({ lineNumber, text }) => {
    const [recipientText, amountText, ...extra] = text.split(/[\s,;]+/).filter(Boolean);

    if (!recipientText || !amountText || extra.length > 0) {
      throw new Error(`Line ${lineNumber}: use "0xRecipient amount" or "0xRecipient,amount"`);
    }

    if (!isAddress(recipientText)) {
      throw new Error(`Line ${lineNumber}: invalid recipient address`);
    }

    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amountText)) {
      throw new Error(`Line ${lineNumber}: invalid amount`);
    }

    const amount = decimals === 18 ? parseEther(amountText) : parseUnits(amountText, decimals);
    if (amount <= 0n) {
      throw new Error(`Line ${lineNumber}: amount must be greater than zero`);
    }

    return {
      lineNumber,
      recipient: getAddress(recipientText),
      amount,
      amountText,
    };
  });
}

export async function checkPaymasterSupport(address?: Address | string, chainId?: number): Promise<boolean> {
  const resolvedChainId = resolveChainId(chainId);
  const provider = createBaseFlowProvider(resolvedChainId);
  const account = address ? resolveAddress(address, 'address') : await getConnectedBaseAccount(provider);

  try {
    const capabilities = await provider.request<Record<string, { paymasterService?: { supported?: boolean } }>>({
      method: 'wallet_getCapabilities',
      params: [account],
    });

    return Boolean(capabilities[String(resolvedChainId)]?.paymasterService?.supported);
  } catch {
    return false;
  }
}

function createBaseFlowProvider(chainId: number): Eip1193Provider {
  if (typeof window === 'undefined') {
    throw new Error('BaseFlow transactions must be started in the browser');
  }

  const sdk = createBaseAccountSDK({
    appName: 'BaseFlow',
    appLogoUrl: process.env.NEXT_PUBLIC_BASEFLOW_APP_LOGO_URL || undefined,
    appChainIds: [chainId],
  });

  return sdk.getProvider() as Eip1193Provider;
}

function createBaseFlowPublicClient(chainId: number) {
  const chain = chainId === baseSepolia.id ? baseSepolia : baseChain;

  if (chain.id !== chainId) {
    throw new Error('Token checks currently support Base mainnet and Base Sepolia only');
  }

  return createPublicClient({
    chain,
    transport: http(),
  });
}

function buildApprovalCall(tokenAddress: Address, spender: Address, amount: bigint): MultisendCall {
  return {
    to: tokenAddress,
    value: '0x0',
    data: encodeFunctionData({
      abi: baseFlowErc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    }),
  };
}

async function getConnectedBaseAccount(provider: Eip1193Provider): Promise<Address> {
  const cryptoAccount = await getCryptoKeyAccount();
  const cryptoAddress = cryptoAccount?.account?.address;

  if (cryptoAddress && isAddress(cryptoAddress)) {
    return getAddress(cryptoAddress);
  }

  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  const account = accounts[0];

  if (!account || !isAddress(account)) {
    throw new Error('Connect your Base Account before launching a batch');
  }

  return getAddress(account);
}

function resolvePaymasterUrl(paymasterProxyUrl?: string): string {
  const configuredUrl = paymasterProxyUrl || process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL || '/api/paymaster';

  if (/^https?:\/\//i.test(configuredUrl)) {
    return configuredUrl;
  }

  if (typeof window === 'undefined') {
    throw new Error('Relative paymaster URLs require a browser origin');
  }

  return new URL(configuredUrl, window.location.origin).toString();
}

function resolveAddress(value: Address | string | undefined, label: string): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} is missing or invalid`);
  }

  return getAddress(value);
}

function resolveChainId(chainId?: number): number {
  if (chainId) {
    return chainId;
  }

  const envChainId = Number(process.env.NEXT_PUBLIC_BASEFLOW_CHAIN_ID);
  if (Number.isInteger(envChainId) && envChainId > 0) {
    return envChainId;
  }

  return baseAccount.constants.CHAIN_IDS.base;
}

function sumRecipientAmounts(recipients: Pick<ParsedRecipient, 'amount'>[]): bigint {
  return recipients.reduce((total, item) => total + item.amount, 0n);
}

function validateDecimals(decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('tokenDecimals must be an integer between 0 and 255');
  }

  return decimals;
}
