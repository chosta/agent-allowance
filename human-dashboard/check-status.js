import { createPublicClient, http, formatUnits } from 'viem';

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

// Addresses
const DONI = '0xb67E430818807282AA0aB08A139fe55e6Bad171b';
const CLAUDE = '0x7b4F4F0F01DB4Fc1e32b74ed4540A801036Fb876';
const GEM = '0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7';

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// AAM ABI (minimal)
const aamAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getAllowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'address' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint8' }] },
  { name: 'getAvailable', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getChildren', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'address[]' }] },
];

// ERC20 ABI
const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function checkStatus() {
  console.log('=== AAM Status Check ===\n');

  // Check gas (native) balances
  console.log('--- Gas (Native USDC) Balances ---');
  for (const [name, addr] of [['Doni', DONI], ['Claude', CLAUDE], ['Gem', GEM]]) {
    const balance = await client.getBalance({ address: addr });
    console.log(`${name}: ${formatUnits(balance, 6)} USDC (gas)`);
  }

  // Check AAM pool balances
  console.log('\n--- AAM Pool Balances ---');
  for (const [name, addr] of [['Doni', DONI], ['Claude', CLAUDE], ['Gem', GEM]]) {
    const balance = await client.readContract({
      address: AAM_ADDRESS,
      abi: aamAbi,
      functionName: 'balanceOf',
      args: [addr],
    });
    console.log(`${name}: ${formatUnits(balance, 6)} USDC (AAM pool)`);
  }

  // Check allowances from Doni
  console.log('\n--- Allowances from Doni ---');
  for (const [name, addr] of [['Claude', CLAUDE], ['Gem', GEM]]) {
    const available = await client.readContract({
      address: AAM_ADDRESS,
      abi: aamAbi,
      functionName: 'getAvailable',
      args: [DONI, addr],
    });
    console.log(`${name}: ${formatUnits(available, 6)} USDC available`);
  }

  // Check if Claude/Gem have any children
  console.log('\n--- Children (sub-agents) ---');
  for (const [name, addr] of [['Claude', CLAUDE], ['Gem', GEM]]) {
    const childrenList = await client.readContract({
      address: AAM_ADDRESS,
      abi: aamAbi,
      functionName: 'getChildren',
      args: [addr],
    });
    console.log(`${name}: ${childrenList.length} children ${childrenList.length > 0 ? JSON.stringify(childrenList) : ''}`);
  }
}

checkStatus().catch(console.error);
