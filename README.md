# Agent Allowance Manager (AAM)

[![CI](https://github.com/chosta/agent-allowance/actions/workflows/ci.yml/badge.svg)](https://github.com/chosta/agent-allowance/actions/workflows/ci.yml)

**Stripe Issuing for AI Agents** — Give your agents USDC spending allowances with rate limits.

## Overview

AAM (Agent Allowance Manager) enables humans or parent agents to give child agents controlled access to USDC funds. Instead of giving agents full wallet access, you set up rate-limited allowances:

- **CAP allowances**: Fixed budget that resets periodically (e.g., 100 USDC/week)
- **STREAM allowances**: Continuous drip over time (e.g., 50 USDC over 30 days)

Think of it like giving your AI a prepaid card with spending limits.

## Why AAM?

As AI agents become more autonomous, they need to transact on-chain. But giving agents full wallet access is dangerous. AAM provides:

- **Rate limits**: Cap spending per period
- **Parental controls**: Pause, unpause, or revoke anytime
- **Accountability**: All spending is logged on-chain
- **Flexibility**: Works with any agent framework

## Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Parent    │                    │    Child    │
│ (Human/Bot) │                    │   (Agent)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ deposit()                        │ spend()
       │ createAllowance()                │
       ▼                                  ▼
┌───────────────────────────────────────────────┐
│                    AAM                         │
│  ┌─────────────────────────────────────────┐  │
│  │  Parent Balances                        │  │
│  │  alice: 1000 USDC                       │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │  Allowances                             │  │
│  │  alice → bot1: 100 USDC/week (CAP)      │  │
│  │  alice → bot2: 50 USDC/month (STREAM)   │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
                       │
                       ▼
                  ┌─────────┐
                  │  USDC   │
                  └─────────┘
```

## Contract API

### Deposit & Withdraw

| Function | Description |
|----------|-------------|
| `deposit(uint256 amount)` | Deposit USDC (requires prior approval) |
| `depositWithPermit(...)` | Deposit using EIP-2612 permit (single tx) |
| `withdraw(uint256 amount)` | Withdraw USDC back to your wallet |
| `balanceOf(address)` | View your deposited balance |

### Allowance Management

| Function | Description |
|----------|-------------|
| `createAllowance(child, type, limit, period)` | Create a new allowance |
| `pause(child)` | Temporarily disable spending |
| `unpause(child)` | Re-enable a paused allowance |
| `revoke(child)` | Permanently disable allowance |

### Spending (Child)

| Function | Description |
|----------|-------------|
| `spend(parent, amount, recipient)` | Spend from allowance |
| `getAvailable(parent, child)` | Check available spending amount |
| `getAllowance(parent, child)` | Get full allowance details |

### Allowance Types

```solidity
enum AllowanceType {
    CAP,    // Periodic reset (100 USDC/week resets every week)
    STREAM  // Continuous drip (50 USDC over 30 days)
}
```

## Usage Examples

### Setup an Allowance (Parent)

```solidity
// 1. Approve USDC spending
usdc.approve(address(aam), 1000e6);

// 2. Deposit funds
aam.deposit(1000e6);

// 3. Create allowance: 100 USDC per week
aam.createAllowance(
    agentAddress,
    AAM.AllowanceType.CAP,
    100e6,      // 100 USDC (6 decimals)
    1 weeks     // Period
);
```

### Spend from Allowance (Agent)

```solidity
// Check available balance
uint256 available = aam.getAvailable(parentAddress, myAddress);

// Spend 50 USDC to a vendor
if (available >= 50e6) {
    aam.spend(parentAddress, 50e6, vendorAddress);
}
```

### Control an Allowance (Parent)

```solidity
// Emergency pause
aam.pause(agentAddress);

// Resume later
aam.unpause(agentAddress);

// Permanently revoke
aam.revoke(agentAddress);
```

## Deployment

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- USDC on your target network
- Private key with ETH for gas

### Deploy to Testnet

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia
export RPC_URL=https://sepolia.base.org

# Run deployment
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### USDC Addresses

| Network | USDC Address |
|---------|--------------|
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Arc Testnet | See [Circle Docs](https://developers.circle.com/stablecoins/docs/usdc-on-test-networks) |

### Local Testing with Anvil

```bash
# Start local node
anvil

# Deploy with mock USDC
USDC_ADDRESS=<deployed-mock> PRIVATE_KEY=<anvil-key> \
  forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Development

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testSpend
```

### Security Analysis

```bash
# Install Slither
pip install slither-analyzer

# Run analysis
slither src/ --exclude-dependencies
```

### Format

```bash
forge fmt
```

## Security Considerations

- **Allowance limits are enforced on-chain** — agents cannot bypass them
- **Parents retain full control** — can pause/revoke at any time
- **Period resets are lazy** — gas-efficient, calculated on-demand
- **STREAM math is bounded** — no overflow possible with reasonable values
- **Tested with 22 passing tests** including edge cases
- **Slither-clean** — no high/medium security issues

## License

MIT
