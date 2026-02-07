import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

console.log('# Claude Sub-Agent Wallets');
console.log('# Generated:', new Date().toISOString());
console.log('');

// Generate 3 sub-agent wallets with random keys
for (let i = 0; i < 3; i++) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const label = String.fromCharCode(65 + i); // A, B, C
  
  console.log(`# Claude Sub-Agent ${label}`);
  console.log(`CLAUDE_SUB_${label}_PRIVATE_KEY=${privateKey}`);
  console.log(`CLAUDE_SUB_${label}_ADDRESS=${account.address}`);
  console.log('');
}
