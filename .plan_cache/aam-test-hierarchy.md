# Plan: AAM Test Hierarchy Setup

**Task ID:** USD-009
**Created:** 2026-02-07T17:39:00Z
**Approved by:** Doni

## Objective

Create a complete, realistic AAM test hierarchy on Arc Testnet demonstrating the full parent → agent → sub-agent flow with varied CAP settings. This serves as the demo for hackathon submission.

## Target Hierarchy

```
Doni (Human Root) — deposits 20 USDC
    │
    ├── Borg (10 USDC/week CAP)
    │       ├── Claude (3 USDC/day CAP)
    │       └── Gem (2 USDC/week CAP)
    │
    └── Ops (5 USDC/day CAP)
            └── Worker1 (1 USDC/day CAP)
```

## Context

### Contract Addresses (Arc Testnet)
- AAM: `0x41c7e0eBf40Fe2d95C6ffd967cD210D4Bab30c72`
- USDC: Check from deploy script or Circle docs for Arc

### Existing Wallets (keys in ~/agent-allowance/.env.testnet)
- Borg: `0x9D751fAb26e43404EcD444D94DF84133518Fa4F3`
- Claude: `0x7b4F4F0F01DB4Fc1e32b74ed4540A801036Fb876`
- Gem: `0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7`
- Deployer: `0x19493d578b737C7F9271778adD5f4249f9733702`

### Wallets to Generate
- Ops (new)
- Worker1 (new)

### RPC
Arc Testnet RPC: https://rpc.testnet.arc.circle.com (verify)

## Execution Steps

### Phase 0: Pre-flight
1. Confirm Arc Testnet USDC address from deploy/Circle docs
2. Generate Ops + Worker1 wallets, add to .env.testnet
3. Determine which wallet Doni will use (new or deployer)
4. **WAIT:** User sends 20 USDC to Doni wallet on Arc Testnet

### Phase 1: Root Setup (from Doni wallet)
5. `USDC.approve(AAM, 20e6)`
6. `AAM.deposit(20e6)` — Doni now has 20 USDC in AAM
7. `AAM.createAllowance(Borg, CAP=0, 10e6, 604800)` — 10 USDC/week
8. `AAM.createAllowance(Ops, CAP=0, 5e6, 86400)` — 5 USDC/day

### Phase 2: Gas Seeding (from Doni wallet - direct USDC transfers for gas)
9. `USDC.transfer(Borg, 0.5e6)` — gas money
10. `USDC.transfer(Ops, 0.3e6)` — gas money

### Phase 3: Borg Claims & Creates Children (from Borg wallet)
11. `AAM.spend(Doni, 5e6, Borg)` — claim 5 USDC from allowance
12. `USDC.approve(AAM, 5e6)`
13. `AAM.deposit(5e6)` — Borg now has balance in AAM
14. `AAM.createAllowance(Claude, CAP=0, 3e6, 86400)` — 3 USDC/day
15. `AAM.createAllowance(Gem, CAP=0, 2e6, 604800)` — 2 USDC/week

### Phase 4: Ops Claims & Creates Child (from Ops wallet)
16. `AAM.spend(Doni, 2e6, Ops)` — claim 2 USDC
17. `USDC.approve(AAM, 2e6)`
18. `AAM.deposit(2e6)`
19. `AAM.createAllowance(Worker1, CAP=0, 1e6, 86400)` — 1 USDC/day

### Phase 5: Demo Spends (proves hierarchy works)
20. Claude needs gas: `USDC.transfer(Claude, 0.1e6)` from Borg
21. Worker1 needs gas: `USDC.transfer(Worker1, 0.1e6)` from Ops
22. Claude: `AAM.spend(Borg, 0.5e6, <recipient>)` — L2 spend
23. Worker1: `AAM.spend(Ops, 0.25e6, <recipient>)` — other branch L2 spend

### Phase 6: Verification & Documentation
24. Open dashboard: http://209.38.108.24:4173
25. Connect with Doni wallet
26. Screenshot full hierarchy showing spent amounts
27. Collect all tx hashes into SUBMISSION_NOTES.md

## Tools

Use `cast` (foundry) for transactions:
```bash
~/.foundry/bin/cast send --rpc-url $RPC --private-key $PK <to> "function(args)" <args>
```

## Success Criteria

- [ ] All 6 wallets have addresses documented
- [ ] All allowances visible on dashboard when connected as Doni
- [ ] At least 3 spend transactions (Borg, Claude, Worker1)
- [ ] All tx hashes collected
- [ ] Dashboard screenshot captured

## Notes

- Arc Testnet uses USDC as native gas token
- CAP type = 0 in contract enum
- Periods: 86400 = 1 day, 604800 = 1 week
- USDC has 6 decimals (1e6 = 1 USDC)
