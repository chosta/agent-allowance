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
const CLAUDE = '0x7b4F4F0F01DB4Fc1e32b74ed4540A801036Fb876';
const CLAUDE_KEY = process.env.PRIVATE_KEY;

// Claude's sub-agents
const CLAUDE_SUBS = [
  { name: 'Sub-A', address: '0x79a6fd7343796FA9d095f8944B8df1e0F347239F' },
  { name: 'Sub-B', address: '0x56B26B77bc39e7136dc1Ae7470756f247870b8db' },
  { name: 'Sub-C', address: '0x704fBdeF9cfC0fB0298adE7E1398594eCEfa9556' },
];

const account = privateKeyToAccount(CLAUDE_KEY);

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
  console.log('=== Claude Creating Sub-Agent Allowances ===\n');
  console.log(`Claude wallet: ${account.address}`);

  // Step 1: Check how much Claude can spend from Doni
  const available = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'getAvailable',
    args: [DONI, CLAUDE],
  });
  console.log(`\nAvailable from Doni: ${formatUnits(available, 6)} USDC`);

  if (available === 0n) {
    console.log('No allowance available from Doni!');
    return;
  }

  // Step 2: Spend 15 USDC to Claude's wallet
  const spendAmount = parseUnits('15', 6); // 15 USDC
  console.log(`\n1. Spending ${formatUnits(spendAmount, 6)} USDC from Doni's allowance...`);
  
  const spendHash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'spend',
    args: [DONI, spendAmount, CLAUDE],
  });
  console.log(`   Tx: ${spendHash}`);
  await publicClient.waitForTransactionReceipt({ hash: spendHash });
  console.log('   ✅ Spent!');

  // Step 3: Check Claude's USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [CLAUDE],
  });
  console.log(`   Claude USDC balance: ${formatUnits(usdcBalance, 6)}`);

  // Step 4: Approve AAM to spend Claude's USDC
  console.log('\n2. Approving AAM to spend Claude\'s USDC...');
  const approveHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAM_ADDRESS, spendAmount],
  });
  console.log(`   Tx: ${approveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log('   ✅ Approved!');

  // Step 5: Deposit USDC into AAM
  console.log('\n3. Depositing USDC into AAM as Claude\'s pool...');
  const depositHash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'deposit',
    args: [spendAmount],
  });
  console.log(`   Tx: ${depositHash}`);
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('   ✅ Deposited!');

  // Step 6: Check Claude's AAM balance
  const aamBalance = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'balanceOf',
    args: [CLAUDE],
  });
  console.log(`   Claude AAM balance: ${formatUnits(aamBalance, 6)} USDC`);

  // Step 7: Create allowances for 3 sub-agents (4 USDC each, weekly)
  const allowanceAmount = parseUnits('4', 6); // 4 USDC per sub-agent
  const period = 7 * 24 * 60 * 60; // 1 week in seconds

  console.log('\n4. Creating allowances for sub-agents...');
  for (const sub of CLAUDE_SUBS) {
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
  console.log('Claude now has 3 sub-agents with 4 USDC/week allowances each.');
}

main().catch(console.error);
