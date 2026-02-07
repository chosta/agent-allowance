import { english, generateMnemonic, mnemonicToSeedSync } from 'viem/accounts';
import { HDKey } from '@scure/bip32';
import { privateKeyToAccount } from 'viem/accounts';

// Generate a new mnemonic for Claude's sub-agents
const mnemonic = generateMnemonic(english);
const seed = mnemonicToSeedSync(mnemonic);
const hdKey = HDKey.fromMasterSeed(seed);

console.log('# Claude Sub-Agent Wallets');
console.log('# Generated:', new Date().toISOString());
console.log('#');
console.log('# MNEMONIC (BACKUP THIS!)');
console.log(`CLAUDE_SUB_MNEMONIC="${mnemonic}"`);
console.log('');

// Derive 3 sub-agent wallets using BIP-44 path: m/44'/60'/0'/0/index
for (let i = 0; i < 3; i++) {
  const path = `m/44'/60'/0'/0/${i}`;
  const derived = hdKey.derive(path);
  const privateKey = `0x${Buffer.from(derived.privateKey).toString('hex')}`;
  const account = privateKeyToAccount(privateKey);
  const label = String.fromCharCode(65 + i); // A, B, C
  
  console.log(`# Claude Sub-Agent ${label} (path: ${path})`);
  console.log(`CLAUDE_SUB_${label}_PRIVATE_KEY=${privateKey}`);
  console.log(`CLAUDE_SUB_${label}_ADDRESS=${account.address}`);
  console.log('');
}
