# AAM Integration Guide for AI Agents

This document helps AI agents integrate with the Agent Allowance Manager (AAM) contract.

## Contract Addresses

| Network | AAM Contract | USDC Token |
|---------|--------------|------------|
| Arc Testnet | `0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72` | `0x3600000000000000000000000000000000000000` |
| Base Sepolia | *deploy yourself* | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Core Concepts

1. **You have a parent** — Someone (human or agent) gave you an allowance
2. **You can spend** — Up to your limit, within the rate constraints
3. **You might have children** — You can create sub-allowances for other agents

## Key Functions

### Check Your Available Balance

```typescript
const available = await aam.getAvailable(parentAddress, yourAddress);
// Returns: uint256 — how much USDC you can spend right now
```

### Spend USDC

```typescript
await aam.spend(
  parentAddress,  // Who gave you the allowance
  amount,         // Amount in USDC (6 decimals, so 1 USDC = 1000000)
  recipient       // Where to send the USDC
);
```

### Get Full Allowance Details

```typescript
const [parent, aType, limit, period, spent, lastReset, status] = 
  await aam.getAllowance(parentAddress, yourAddress);

// aType: 0 = CAP (periodic reset), 1 = STREAM (continuous drip)
// status: 0 = Active, 1 = Paused, 2 = Revoked
```

## Integration Example (viem)

```typescript
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const AAM_ADDRESS = '0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72';

const aamAbi = [
  {
    name: 'getAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'spend',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'parent' },
      { type: 'uint256', name: 'amount' },
      { type: 'address', name: 'recipient' }
    ],
    outputs: []
  },
  {
    name: 'getAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }],
    outputs: [
      { type: 'address' },
      { type: 'uint8' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint8' }
    ]
  }
];

// Check balance before spending
async function checkAndSpend(parentAddress, amount, recipient) {
  const available = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'getAvailable',
    args: [parentAddress, myAddress],
  });

  if (available < amount) {
    throw new Error(`Insufficient allowance: ${available} < ${amount}`);
  }

  const hash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'spend',
    args: [parentAddress, amount, recipient],
  });

  return hash;
}
```

## Integration Example (ethers.js v6)

```typescript
import { ethers } from 'ethers';

const AAM_ADDRESS = '0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72';

const aamAbi = [
  'function getAvailable(address parent, address child) view returns (uint256)',
  'function spend(address parent, uint256 amount, address recipient)',
  'function getAllowance(address parent, address child) view returns (address, uint8, uint256, uint256, uint256, uint256, uint8)'
];

const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const aam = new ethers.Contract(AAM_ADDRESS, aamAbi, wallet);

// Spend 5 USDC
const amount = ethers.parseUnits('5', 6); // 6 decimals
await aam.spend(parentAddress, amount, recipientAddress);
```

## Error Messages

| Error | Meaning |
|-------|---------|
| `NotEnough` | Amount exceeds available balance |
| `NoAllowance` | No allowance exists from this parent |
| `Paused` | Parent has paused your allowance |
| `Revoked` | Parent has permanently revoked your allowance |
| `NotParent` | You're not the parent of this child |
| `AlreadyExists` | Allowance already exists for this child |

## Best Practices

1. **Always check `getAvailable()` before spending** — Don't assume your balance
2. **Handle failures gracefully** — Parent might pause you at any time
3. **Log your transactions** — Keep receipts for accountability
4. **Use reasonable amounts** — Spending close to limits may fail due to timing

## Creating Sub-Allowances

If you're a parent agent with funds:

```typescript
// First deposit USDC into AAM
await usdc.approve(AAM_ADDRESS, amount);
await aam.deposit(amount);

// Create allowance for sub-agent
await aam.createAllowance(
  childAddress,
  0,              // 0 = CAP, 1 = STREAM
  parseUnits('10', 6),  // 10 USDC limit
  7 * 24 * 60 * 60      // 1 week period
);
```

## Arc Testnet Details

- **Chain ID:** 5042002
- **RPC:** https://rpc.testnet.arc.network
- **Native Currency:** USDC (6 decimals)
- **Block Explorer:** https://testnet.arc.network

Note: Arc testnet uses USDC as native gas, so you need USDC for both gas and spending.
