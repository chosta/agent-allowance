# AAM Hackathon Submission Notes

## Pre-Submission Checklist

### Critical (Must Do)
- [x] Push code to GitHub with good README
- [ ] Verify contract source on Arc Explorer
- [x] Include deployment tx hash in submission
- [x] Include tx hash of allowance creation + spend
- [ ] Vote on 5+ projects (required to be eligible!)

### Recommended
- [ ] Deploy frontend to Vercel (or get domain) — IP address looks sketchy
- [ ] Record 2-min video demo showing full flow
- [ ] Package agent interaction as a Skill (for Skill track)

### Track Submission
Submit to ALL 3:
1. **SmartContract** — `#USDCHackathon ProjectSubmission SmartContract`
2. **AgenticCommerce** — `#USDCHackathon ProjectSubmission AgenticCommerce`
3. **Skill** — `#USDCHackathon ProjectSubmission Skill` (if we add agent skill)

### Submission Content Required
- Summary (1-2 sentences)
- What I Built
- How It Functions
- Proof of Work (contract address, tx hash, explorer link)
- Code (GitHub link)
- Why It Matters

### Our Strengths
- Arc Testnet (Circle's L1 with USDC as native gas) — big plus
- Working dashboard with UI
- Clear narrative: "Corporate expense cards for AI"
- Novel hierarchical allowance pattern

### Deadline
**Feb 8, 2026 @ 12:00 PM PST** (10 PM Sofia time)

---

## Test Deployment (Arc Testnet) — 2026-02-07

### Contracts
| Contract | Address |
|----------|---------|
| AAM | `0x177d97C5D69D783DCa87D27E4344bb3b9a87D30d` |
| USDC | `0x3600000000000000000000000000000000000000` |

### Wallet Hierarchy
```
Doni (Human Root) — 0x19493d578b737C7F9271778adD5f4249f9733702
    │
    ├── Borg (10 USDC/week)  — 0x9D751fAb26e43404EcD444D94DF84133518Fa4F3
    │       ├── Claude (3 USDC/day) — 0x7b4F4F0F01DB4Fc1e32b74ed4540A801036Fb876
    │       └── Gem (2 USDC/week) — 0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7
    │
    └── Ops (5 USDC/day) — 0xb0a93e73BC6ADaC14ea1660f645F54007024B877
            └── Worker1 (1 USDC/day) — 0x91CD1a80DfCA266B7771eaBf420CF07c9b6708cd
```

### Transaction Hashes (Proof of Work)

| Phase | Action | TX Hash |
|-------|--------|---------|
| 1 | Doni approves AAM | `0xb24f120542a8e214a1d7d6aa973905c0438e5bf1a005d6650092a430b85f086c` |
| 1 | Doni deposits 20 USDC | `0x364c57cfac26a2ae2b2ef7b80c833f3b1bcdbff4207c4933488cb90562dcb494` |
| 1 | Doni → Ops allowance | `0xe1a852e851f582c86b4812668c2c3ff03dfb343b595ad3eb3a1354b26967bcc2` |
| 2 | Doni → Borg gas | `0xe10e9639f559194168a9da0d29961b8cb018a86648c56bcc47a37bafd9ae8061` |
| 2 | Doni → Ops gas | `0x3f7303168b8c5dda6671ee1150769d0bc0254c024b8be07b4cd085384b386d46` |
| 3 | Borg spends from Doni | `0x89471150d9554888418966bb215cc61b4bcb14c44f1107fbccfeb31efc78e679` |
| 3 | Borg approves AAM | `0x29dcc03bb982c6876d37811572270dceb1724c4e46b09e37a08fd042bf99b0d4` |
| 3 | Borg deposits | `0x3bba40715c3ddc76d5d96144a4f99eca820239b5f86ac176b7de29c33cf9f747` |
| 3 | Borg → Claude allowance | `0x5a818804a3a391d65ce6188b2447e55842dfc5cb1acbd43f99b9c9146bd3adeb` |
| 3 | Borg → Gem allowance | `0xc1d644f855e3e3379a4d8caf68ece23b2df639b9e3a95dca4fa84925cf27aa2b` |
| 4 | Ops spends from Doni | `0x3385ece156f1f39a29024003842e5225f178ad141b21e898dc3e9f938f1ba75b` |
| 4 | Ops approves AAM | `0x642508271fd6d1d01d3cfb38ea974f1ab7bcde57933c24bc89cd9fcc753f383d` |
| 4 | Ops deposits | `0xd69e711e9fc5c1205ec3357d7882b61ad2969a14e7684e20839634b72c2fb0bb` |
| 4 | Ops → Worker1 allowance | `0x4ca87fc05f2a46609478a416cdee792472a8d4ced85ee61e802105baf32701f5` |
| 5 | Borg → Claude gas | `0xbebd8013a6194011bb73758860cf641fca2ab3248c9acb5e64df0732e9695081` |
| 5 | Ops → Worker1 gas | `0x6d3976a996b31ee2cb212700e766fe4deb84641cee13d365ba4aa38c1ba58d9d` |
| 5 | **Claude spends from Borg** | `0xa279e2309be32fbbec15d5220c42cab8a8145b9249ba9a6fc7f9ede80ba6ddcf` |
| 5 | **Worker1 spends from Ops** | `0x3a6c8247948c9b298e5e11a307c349f9f2a7ec7d6d6c54742807a11fce82d8e6` |

### Explorer Links
- Arc Testnet Explorer: https://testnet.arcscan.io (or equivalent)
- AAM Contract: `https://testnet.arcscan.io/address/0x177d97C5D69D783DCa87D27E4344bb3b9a87D30d`

### Dashboard
- **Live:** http://209.38.108.24:4173
- Connect with Doni wallet to view full hierarchy
