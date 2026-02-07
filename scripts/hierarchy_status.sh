#!/bin/bash
# hierarchy_status.sh - Display AAM hierarchy status
# Created: 2026-02-07

set -e

# Config
CAST="${HOME}/.foundry/bin/cast"
RPC="https://rpc.testnet.arc.network"
AAM="0x177d97C5D69D783DCa87D27E4344bb3b9a87D30d"
USDC="0x3600000000000000000000000000000000000000"

# Addresses
DEPLOYER="0x19493d578b737C7F9271778adD5f4249f9733702"
BORG="0x9D751fAb26e43404EcD444D94DF84133518Fa4F3"
GEM="0x55E41ebdE0D56B8ddc4Ff3b7945e8a6F8294B2a7"
SUBAGENT_A="0xA2235Ab10e9dCFD053ce47E360F17F6ba8b18e31"
SUBAGENT_B="0x5C3Dcf6883E48aA6ea57e436893466de3f801c5d"

# Helper: format USDC (6 decimals)
format_usdc() {
    local raw=$1
    local dec=$((raw / 1000000))
    local frac=$((raw % 1000000))
    printf "%d.%06d" $dec $frac
}

# Get balance (pool)
get_pool() {
    local addr=$1
    local result=$($CAST call $AAM "balanceOf(address)" $addr --rpc-url $RPC 2>/dev/null)
    printf "%d" $((result))
}

# Get available allowance
get_available() {
    local parent=$1
    local child=$2
    local result=$($CAST call $AAM "getAvailable(address,address)" $parent $child --rpc-url $RPC 2>/dev/null)
    printf "%d" $((result))
}

# Get wallet balance
get_wallet() {
    local addr=$1
    local result=$($CAST call $USDC "balanceOf(address)" $addr --rpc-url $RPC 2>/dev/null)
    printf "%d" $((result))
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Agent Allowance Manager - Hierarchy Status           ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║ Contract: $AAM ║"
echo "║ Network:  Arc Testnet (Chain ID: 5042002)                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Pool Balances (deposited in AAM):"
echo "─────────────────────────────────────"
deployer_pool=$(get_pool $DEPLOYER)
borg_pool=$(get_pool $BORG)
gem_pool=$(get_pool $GEM)
echo "  Deployer (Root): $(format_usdc $deployer_pool) USDC"
echo "  Borg:            $(format_usdc $borg_pool) USDC"
echo "  Gem:             $(format_usdc $gem_pool) USDC"
echo ""

echo "🎫 Allowances (available to spend):"
echo "─────────────────────────────────────"
echo "  From Deployer:"
borg_allow=$(get_available $DEPLOYER $BORG)
gem_allow=$(get_available $DEPLOYER $GEM)
echo "    → Borg: $(format_usdc $borg_allow) USDC/week"
echo "    → Gem:  $(format_usdc $gem_allow) USDC/week"
echo ""
echo "  From Borg:"
sa_allow=$(get_available $BORG $SUBAGENT_A)
sb_allow=$(get_available $BORG $SUBAGENT_B)
echo "    → SubagentA: $(format_usdc $sa_allow) USDC/week"
echo "    → SubagentB: $(format_usdc $sb_allow) USDC/week"
echo ""

echo "💰 Wallet Balances (raw USDC):"
echo "─────────────────────────────────────"
echo "  Deployer:   $(format_usdc $(get_wallet $DEPLOYER)) USDC"
echo "  Borg:       $(format_usdc $(get_wallet $BORG)) USDC"
echo "  Gem:        $(format_usdc $(get_wallet $GEM)) USDC"
echo "  SubagentA:  $(format_usdc $(get_wallet $SUBAGENT_A)) USDC"
echo "  SubagentB:  $(format_usdc $(get_wallet $SUBAGENT_B)) USDC"
echo ""

echo "🔗 Explorer: https://testnet.arcscan.app/address/$AAM"
