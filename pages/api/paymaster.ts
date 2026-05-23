import type { NextApiRequest, NextApiResponse } from 'next';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type ErrorResponse = {
  error: string;
};

const DEFAULT_ALLOWED_ORIGINS = new Set(['https://keys.coinbase.com']);

export default async function handler(req: NextApiRequest, res: NextApiResponse<string | ErrorResponse>) {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Origin is not allowed to use this paymaster proxy' });
  }

  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymasterUrl = process.env.CDP_PAYMASTER_URL;
  if (!paymasterUrl) {
    return res.status(500).json({ error: 'CDP_PAYMASTER_URL is not configured' });
  }

  if (!isSafeHttpUrl(paymasterUrl)) {
    return res.status(500).json({ error: 'CDP_PAYMASTER_URL must be a valid HTTPS URL' });
  }

  const payload = parseJsonBody(req.body);
  if (!payload || !hasOnlyPaymasterMethods(payload)) {
    return res.status(400).json({ error: 'Invalid ERC-7677 paymaster JSON-RPC request' });
  }

  const allowedTarget = normalizeAddress(
    process.env.MULTISENDER_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_MULTISENDER_CONTRACT_ADDRESS,
  );

  if (!allowedTarget && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'MULTISENDER_CONTRACT_ADDRESS is required in production' });
  }

  if (allowedTarget && !payloadReferencesTarget(payload, allowedTarget)) {
    return res.status(403).json({ error: 'Paymaster sponsorship is restricted to the BaseFlow multisender contract' });
  }

  // Security note: this proxy guard is intentionally conservative and best-effort because ERC-7677
  // paymaster requests usually contain smart-account UserOperation calldata rather than a plain
  // wallet_sendCalls array. Keep the CDP Paymaster contract/function allowlist enabled as the
  // authoritative policy. If you later support more account implementations, decode the account
  // execute calldata here and assert the final target equals MULTISENDER_CONTRACT_ADDRESS.
  const upstreamResponse = await fetch(paymasterUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await upstreamResponse.text();
  const contentType = upstreamResponse.headers.get('content-type');

  if (!upstreamResponse.ok) {
    console.warn('CDP paymaster rejected request', {
      status: upstreamResponse.status,
      methods: getJsonRpcMethods(payload),
      body: truncateForLog(responseText),
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  if (contentType) {
    res.setHeader('content-type', contentType);
  }

  return res.status(upstreamResponse.status).send(responseText);
}

function parseJsonBody(body: unknown): JsonValue | null {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as JsonValue;
    } catch {
      return null;
    }
  }

  if (body === null || typeof body !== 'object') {
    return null;
  }

  return body as JsonValue;
}

function hasOnlyPaymasterMethods(payload: JsonValue): boolean {
  const requests = Array.isArray(payload) ? payload : [payload];

  return requests.every((request) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return false;
    }

    const method = request.method;

    // Base Account currently uses the ERC-7677 methods pm_getPaymasterStubData and
    // pm_getPaymasterData. Some wallets/providers add compatible pm_* methods, so
    // avoid rejecting valid paymaster traffic before CDP can apply its policy.
    return typeof method === 'string' && method.startsWith('pm_');
  });
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const configuredOrigins = (process.env.PAYMASTER_ALLOWED_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);

  return allowedOrigins.has(origin);
}

function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getJsonRpcMethods(payload: JsonValue): string[] {
  const requests = Array.isArray(payload) ? payload : [payload];

  return requests.flatMap((request) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return [];
    }

    return typeof request.method === 'string' ? [request.method] : [];
  });
}

function truncateForLog(value: string): string {
  return value.length > 600 ? `${value.slice(0, 600)}...` : value;
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

function normalizeAddress(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const address = value.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(address) ? address : null;
}

function payloadReferencesTarget(payload: JsonValue, allowedTarget: string): boolean {
  const targetWithoutPrefix = allowedTarget.slice(2);
  const seen = new Set<object>();

  function visit(value: JsonValue): boolean {
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();

      if (normalized === allowedTarget) {
        return true;
      }

      return /^0x[0-9a-f]+$/.test(normalized) && normalized.includes(targetWithoutPrefix);
    }

    if (Array.isArray(value)) {
      return value.some(visit);
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return Object.values(value).some(visit);
    }

    return false;
  }

  return visit(payload);
}
