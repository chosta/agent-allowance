---
name: deploy-hierarchy
description: Deploy a complete AAM test hierarchy with parent → agent → sub-agent allowances. Use for testing on any EVM chain with USDC.
---

# AAM Hierarchy Deployment Skill

Deploy a multi-level agent allowance hierarchy for testing or demos.

## Prerequisites

- `cast` (Foundry) installed: `~/.foundry/bin/cast`
- Private keys for all wallets in `.env.testnet`
- USDC funded in root wallet
- AAM contract deployed on target chain

## Hierarchy Structure

```
Root (Human) — deposits USDC
    │
    ├── Agent1 (X USDC/period)
    │       ├── SubAgent1 (Y USDC/period)
    │       └── SubAgent2 (Z USDC/period)
    │
    └── Agent2 (X USDC/period)
            └── SubAgent3 (Y USDC/period)
```

## Configuration

Set these in `.env.testnet`:

```bash
# Network
RPC_URL=https://rpc.testnet.arc.network
AAM_ADDRESS=0x...
USDC_ADDRESS=0x...

# Wallets (private keys)
ROOT_PRIVATE_KEY=0x...
ROOT_ADDRESS=0x...

AGENT1_PRIVATE_KEY=0x...
AGENT1_ADDRESS=0x...

SUBAGENT1_PRIVATE_KEY=0x...
SUBAGENT1_ADDRESS=0x...
# ... etc
```

## Deployment Flow

### Phase 1: Root Setup

From root wallet:

```bash
# 1. Approve AAM to spend USDC
cast send $USDC_ADDRESS "approve(address,uint256)" $AAM_ADDRESS <amount> \
  --rpc-url $RPC_URL --private-key $ROOT_PRIVATE_KEY

# 2. Deposit USDC into AAM
cast send $AAM_ADDRESS "deposit(uint256)" <amount> \
  --rpc-url $RPC_URL --private-key $ROOT_PRIVATE_KEY

# 3. Create allowances for agents
# AllowanceType: 0 = CAP (periodic reset), 1 = STREAM (continuous drip)
# Period in seconds: 86400 = 1 day, 604800 = 1 week
cast send $AAM_ADDRESS "createAllowance(address,uint8,uint256,uint256)" \
  $AGENT1_ADDRESS 0 <limit_6decimals> <period_seconds> \
  --rpc-url $RPC_URL --private-key $ROOT_PRIVATE_KEY
```

### Phase 2: Gas Seeding

Agents need gas to transact. On chains where USDC = gas (Arc), transfer USDC directly:

```bash
cast send $USDC_ADDRESS "transfer(address,uint256)" $AGENT1_ADDRESS 500000 \
  --rpc-url $RPC_URL --private-key $ROOT_PRIVATE_KEY
```

On standard chains (Base, Ethereum), transfer native token for gas separately.

### Phase 3: Agent Claims & Creates Sub-Allowances

Each agent must:
1. Spend from their allowance (claim USDC)
2. Approve AAM
3. Deposit USDC
4. Create sub-allowances

```bash
# Agent1 claims from Root
cast send $AAM_ADDRESS "spend(address,uint256,address)" \
  $ROOT_ADDRESS <amount> $AGENT1_ADDRESS \
  --rpc-url $RPC_URL --private-key $AGENT1_PRIVATE_KEY

# Agent1 approves AAM
cast send $USDC_ADDRESS "approve(address,uint256)" $AAM_ADDRESS <amount> \
  --rpc-url $RPC_URL --private-key $AGENT1_PRIVATE_KEY

# Agent1 deposits
cast send $AAM_ADDRESS "deposit(uint256)" <amount> \
  --rpc-url $RPC_URL --private-key $AGENT1_PRIVATE_KEY

# Agent1 creates sub-allowance
cast send $AAM_ADDRESS "createAllowance(address,uint8,uint256,uint256)" \
  $SUBAGENT1_ADDRESS 0 <limit> <period> \
  --rpc-url $RPC_URL --private-key $AGENT1_PRIVATE_KEY
```

### Phase 4: Demo Spends

To prove hierarchy works, have sub-agents spend:

```bash
# SubAgent1 spends from Agent1
cast send $AAM_ADDRESS "spend(address,uint256,address)" \
  $AGENT1_ADDRESS <amount> <recipient> \
  --rpc-url $RPC_URL --private-key $SUBAGENT1_PRIVATE_KEY
```

## Generating New Wallets

```bash
# Generate a new wallet
cast wallet new

# Or use cast to derive from mnemonic
cast wallet address --mnemonic "your mnemonic" --mnemonic-index 5
```

## Verification

Check balances and allowances:

```bash
# Check AAM balance
cast call $AAM_ADDRESS "balanceOf(address)(uint256)" $ADDRESS --rpc-url $RPC_URL

# Check allowance details
cast call $AAM_ADDRESS "getAllowance(address,address)" $PARENT $CHILD --rpc-url $RPC_URL

# Check available to spend
cast call $AAM_ADDRESS "getAvailable(address,address)(uint256)" $PARENT $CHILD --rpc-url $RPC_URL

# Check children of a parent
cast call $AAM_ADDRESS "getChildren(address)(address[])" $PARENT --rpc-url $RPC_URL
```

## Common Values

| Period | Seconds |
|--------|---------|
| 1 hour | 3600 |
| 1 day | 86400 |
| 1 week | 604800 |
| 30 days | 2592000 |

USDC amounts use 6 decimals:
- 1 USDC = 1000000
- 0.5 USDC = 500000
- 100 USDC = 100000000

## Troubleshooting

### "AAM: allowance exists"
Allowance already created for this parent→child pair. Use a different child address or revoke the existing one.

### "AAM: insufficient balance"
Parent doesn't have enough deposited in AAM. Check `balanceOf(parent)` and deposit more.

### Transaction fails with no error
Check gas. On Arc, USDC is gas — wallet needs USDC to transact.

### Sub-agent can't spend
1. Check if allowance exists: `getAllowance(parent, child)`
2. Check if parent has balance: `balanceOf(parent)`
3. Check if allowance is paused: status should be 1 (Active)

## Example: Full Arc Testnet Deployment

See `.plan_cache/aam-test-hierarchy.md` for a complete worked example with all addresses and tx hashes.
