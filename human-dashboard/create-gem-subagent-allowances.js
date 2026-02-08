import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Arc Testnet config
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

const AAM_ADDRESS = '0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

// Load private key from environment
import 'dotenv/config';

if (!process.env.PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  console.error('Copy .env.example to .env and set your private key');
  process.exit(1);
}

// Addresses
const DONI = '0xb67E430818807282AA0aB08A139fe55e6Bad171b';
const GEM = '0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7';
const GEM_KEY = process.env.PRIVATE_KEY;

// Gem's sub-agents (from .env.testnet)
const GEM_SUBS = [
  { name: 'Sub-A', address: '0xFD6652ebe91c3fE8618497341261DC2C8D24D610' },
  { name: 'Sub-B', address: '0xE07a1F9719A5A7890D7C7b4EEDB3C7CE187539F8' },
  { name: 'Sub-C', address: '0xDcFc05748214e33F3F763b4ccB52e05c26bd5469' },
];

const account = privateKeyToAccount(GEM_KEY);

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(),
});

// AAM ABI
const aamAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'spend', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'parent' }, { type: 'uint256', name: 'amount' }, { type: 'address', name: 'recipient' }], outputs: [] },
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [] },
  { name: 'createAllowance', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'child' }, { type: 'uint8', name: 'aType' }, { type: 'uint256', name: 'limit' }, { type: 'uint256', name: 'period' }], outputs: [] },
  { name: 'getAvailable', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
];

// ERC20 ABI
const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] },
];

async function main() {
  console.log('=== Gem Creating Sub-Agent Allowances ===\n');
  console.log(`Gem wallet: ${account.address}`);

  // Step 1: Check how much Gem can spend from Doni
  const available = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'getAvailable',
    args: [DONI, GEM],
  });
  console.log(`\nAvailable from Doni: ${formatUnits(available, 6)} USDC`);

  if (available === 0n) {
    console.log('No allowance available from Doni!');
    return;
  }

  // Gem only has 2 USDC, so spend all of it
  const spendAmount = available;
  console.log(`\n1. Spending ${formatUnits(spendAmount, 6)} USDC from Doni's allowance...`);
  
  const spendHash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'spend',
    args: [DONI, spendAmount, GEM],
  });
  console.log(`   Tx: ${spendHash}`);
  await publicClient.waitForTransactionReceipt({ hash: spendHash });
  console.log('   ✅ Spent!');

  // Step 2: Approve AAM to spend Gem's USDC
  console.log('\n2. Approving AAM to spend Gem\'s USDC...');
  const approveHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAM_ADDRESS, spendAmount],
  });
  console.log(`   Tx: ${approveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log('   ✅ Approved!');

  // Step 3: Deposit USDC into AAM
  console.log('\n3. Depositing USDC into AAM as Gem\'s pool...');
  const depositHash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'deposit',
    args: [spendAmount],
  });
  console.log(`   Tx: ${depositHash}`);
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('   ✅ Deposited!');

  // Step 4: Check Gem's AAM balance
  const aamBalance = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'balanceOf',
    args: [GEM],
  });
  console.log(`   Gem AAM balance: ${formatUnits(aamBalance, 6)} USDC`);

  // Step 5: Create allowance for 1 sub-agent (Gem only has 2 USDC)
  // 0.5 USDC per sub-agent, weekly
  const allowanceAmount = parseUnits('0.5', 6);
  const period = 7 * 24 * 60 * 60; // 1 week

  console.log('\n4. Creating allowances for sub-agents (0.5 USDC/week each)...');
  for (const sub of GEM_SUBS) {
    console.log(`   Creating allowance for ${sub.name} (${sub.address.slice(0, 10)}...)...`);
    const hash = await walletClient.writeContract({
      address: AAM_ADDRESS,
      abi: aamAbi,
      functionName: 'createAllowance',
      args: [sub.address, 0, allowanceAmount, period], // 0 = CAP type
    });
    console.log(`   Tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash: hash });
    console.log(`   ✅ ${sub.name} allowance created!`);
  }

  console.log('\n=== DONE ===');
  console.log('Gem now has 3 sub-agents with 0.5 USDC/week allowances each.');
}

main().catch(console.error);
