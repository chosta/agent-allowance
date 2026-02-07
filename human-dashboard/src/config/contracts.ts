// Contract addresses
export const AAM_ADDRESS = '0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72' as const
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

// Known agents for demo
export const KNOWN_AGENTS = {
  doni: '0x1edCa0aD1e5FC6f329d05Ae32f13348BCA15aebD',
  borg: '0xfbbd48A7e115c251A4e66B6f0e8a59Cf9CAcF08F',
  claude: '0x7b4F4F0F01DB4Fc1e32b74ed4540A801036Fb876',
  gem: '0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7',
  gemSubA: '0xFD6652ebe91c3fE8618497341261DC2C8D24D610',
  gemSubB: '0xE07a1F9719A5A7890D7C7b4EEDB3C7CE187539F8',
} as const

// AAM ABI
export const AAM_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createAllowance',
    inputs: [
      { name: 'child', type: 'address' },
      { name: 'aType', type: 'uint8' },
      { name: 'limit', type: 'uint256' },
      { name: 'period', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAllowance',
    inputs: [
      { name: 'parent', type: 'address' },
      { name: 'child', type: 'address' },
    ],
    outputs: [
      { name: 'parent_', type: 'address' },
      { name: 'aType', type: 'uint8' },
      { name: 'limit', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'spent', type: 'uint256' },
      { name: 'lastReset', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAvailable',
    inputs: [
      { name: 'parent', type: 'address' },
      { name: 'child', type: 'address' },
    ],
    outputs: [{ name: 'available', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [{ name: 'child', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revoke',
    inputs: [{ name: 'child', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [{ name: 'child', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getChildren',
    inputs: [{ name: 'parent', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getParent',
    inputs: [{ name: 'child', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'parentOf',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AllowanceCreated',
    inputs: [
      { name: 'parent', type: 'address', indexed: true },
      { name: 'child', type: 'address', indexed: true },
      { name: 'aType', type: 'uint8', indexed: false },
      { name: 'limit', type: 'uint256', indexed: false },
      { name: 'period', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'parent', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Spent',
    inputs: [
      { name: 'parent', type: 'address', indexed: true },
      { name: 'child', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Revoked',
    inputs: [
      { name: 'parent', type: 'address', indexed: true },
      { name: 'child', type: 'address', indexed: true },
    ],
  },
] as const

// ERC20 ABI (minimal for USDC)
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const
