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

const GEM = '0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7';
const GEM_KEY = '0xfa2866586efa1e1a6ee4fe27655c1d7f80f817ad1ca061291170957258c57b0a';

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

const aamAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [] },
  { name: 'createAllowance', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'child' }, { type: 'uint8', name: 'aType' }, { type: 'uint256', name: 'limit' }, { type: 'uint256', name: 'period' }], outputs: [] },
];

const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('=== Gem Continuing (deposit + create allowances) ===\n');

  // Check Gem's USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [GEM],
  });
  console.log(`Gem USDC balance: ${formatUnits(usdcBalance, 6)}`);

  // Check current approval
  const currentAllowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [GEM, AAM_ADDRESS],
  });
  console.log(`Current approval for AAM: ${formatUnits(currentAllowance, 6)}`);

  const depositAmount = parseUnits('2', 6); // 2 USDC

  // Deposit into AAM
  console.log('\n1. Depositing USDC into AAM...');
  const depositHash = await walletClient.writeContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'deposit',
    args: [depositAmount],
  });
  console.log(`   Tx: ${depositHash}`);
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log('   ✅ Deposited!');

  // Check AAM balance
  const aamBalance = await publicClient.readContract({
    address: AAM_ADDRESS,
    abi: aamAbi,
    functionName: 'balanceOf',
    args: [GEM],
  });
  console.log(`   Gem AAM balance: ${formatUnits(aamBalance, 6)} USDC`);

  // Create allowances (0.5 USDC each, weekly)
  const allowanceAmount = parseUnits('0.5', 6);
  const period = 7 * 24 * 60 * 60;

  console.log('\n2. Creating allowances for sub-agents...');
  for (const sub of GEM_SUBS) {
    console.log(`   Creating for ${sub.name}...`);
    const hash = await walletClient.writeContract({
      address: AAM_ADDRESS,
      abi: aamAbi,
      functionName: 'createAllowance',
      args: [sub.address, 0, allowanceAmount, period],
    });
    console.log(`   Tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash: hash });
    console.log(`   ✅ ${sub.name} done!`);
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
