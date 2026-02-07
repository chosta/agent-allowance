#!/bin/bash
# AAM Hierarchy Deployment Script
# Usage: ./scripts/deploy-hierarchy.sh
#
# Requires: .env.testnet with all private keys and addresses
# See skills/deploy-hierarchy/SKILL.md for full documentation

set -e

# Load environment
source .env.testnet 2>/dev/null || { echo "Error: .env.testnet not found"; exit 1; }

# Config
CAST=~/.foundry/bin/cast
RPC=${RPC_URL:-"https://rpc.testnet.arc.network"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# Check prerequisites
check_prereqs() {
    if [ ! -f "$CAST" ]; then
        echo "Error: cast not found at $CAST"
        echo "Install Foundry: curl -L https://foundry.paradigm.xyz | bash"
        exit 1
    fi
    
    if [ -z "$AAM_ADDRESS" ] || [ -z "$USDC_ADDRESS" ]; then
        echo "Error: AAM_ADDRESS and USDC_ADDRESS must be set in .env.testnet"
        exit 1
    fi
}

# Get USDC balance
get_balance() {
    local addr=$1
    $CAST call $USDC_ADDRESS "balanceOf(address)(uint256)" $addr --rpc-url $RPC 2>/dev/null | head -1
}

# Get AAM pool balance
get_pool_balance() {
    local addr=$1
    $CAST call $AAM_ADDRESS "balanceOf(address)(uint256)" $addr --rpc-url $RPC 2>/dev/null | head -1
}

# Send transaction and extract hash
send_tx() {
    local result=$($CAST send "$@" --json 2>/dev/null)
    echo "$result" | jq -r '.transactionHash'
}

# Phase 1: Root Setup
phase1_root_setup() {
    echo ""
    echo "=== Phase 1: Root Setup ==="
    
    local root_key=${DEPLOYER_PRIVATE_KEY:-$ROOT_PRIVATE_KEY}
    local root_addr=${DEPLOYER_ADDRESS:-$ROOT_ADDRESS}
    local deposit_amount=${DEPOSIT_AMOUNT:-20000000}  # 20 USDC default
    
    # Check balance
    local balance=$(get_balance $root_addr)
    log "Root balance: $balance (need $deposit_amount)"
    
    # Approve
    warn "Approving AAM to spend USDC..."
    local tx1=$(send_tx $USDC_ADDRESS "approve(address,uint256)" $AAM_ADDRESS $deposit_amount \
        --rpc-url $RPC --private-key $root_key)
    log "Approve TX: $tx1"
    
    # Deposit
    warn "Depositing $deposit_amount to AAM..."
    local tx2=$(send_tx $AAM_ADDRESS "deposit(uint256)" $deposit_amount \
        --rpc-url $RPC --private-key $root_key)
    log "Deposit TX: $tx2"
    
    echo "$tx1" >> tx_hashes.txt
    echo "$tx2" >> tx_hashes.txt
}

# Create allowance helper
create_allowance() {
    local parent_key=$1
    local child_addr=$2
    local limit=$3
    local period=$4
    local name=$5
    
    warn "Creating allowance: $name ($limit / ${period}s)..."
    local tx=$(send_tx $AAM_ADDRESS "createAllowance(address,uint8,uint256,uint256)" \
        $child_addr 0 $limit $period \
        --rpc-url $RPC --private-key $parent_key)
    log "Allowance TX ($name): $tx"
    echo "$tx" >> tx_hashes.txt
}

# Transfer USDC (for gas on Arc)
transfer_usdc() {
    local from_key=$1
    local to_addr=$2
    local amount=$3
    local name=$4
    
    warn "Sending $amount USDC to $name for gas..."
    local tx=$(send_tx $USDC_ADDRESS "transfer(address,uint256)" $to_addr $amount \
        --rpc-url $RPC --private-key $from_key)
    log "Gas TX ($name): $tx"
    echo "$tx" >> tx_hashes.txt
}

# Agent claim + deposit + create sub-allowances
agent_setup() {
    local agent_key=$1
    local agent_addr=$2
    local parent_addr=$3
    local claim_amount=$4
    local deposit_amount=$5
    local agent_name=$6
    
    echo ""
    echo "=== $agent_name Setup ==="
    
    # Spend (claim from parent)
    warn "$agent_name claiming $claim_amount from parent..."
    local tx1=$(send_tx $AAM_ADDRESS "spend(address,uint256,address)" \
        $parent_addr $claim_amount $agent_addr \
        --rpc-url $RPC --private-key $agent_key)
    log "Claim TX: $tx1"
    
    # Approve
    warn "$agent_name approving AAM..."
    local tx2=$(send_tx $USDC_ADDRESS "approve(address,uint256)" $AAM_ADDRESS $deposit_amount \
        --rpc-url $RPC --private-key $agent_key)
    log "Approve TX: $tx2"
    
    # Deposit
    warn "$agent_name depositing $deposit_amount..."
    local tx3=$(send_tx $AAM_ADDRESS "deposit(uint256)" $deposit_amount \
        --rpc-url $RPC --private-key $agent_key)
    log "Deposit TX: $tx3"
    
    echo "$tx1" >> tx_hashes.txt
    echo "$tx2" >> tx_hashes.txt
    echo "$tx3" >> tx_hashes.txt
}

# Demo spend
demo_spend() {
    local child_key=$1
    local parent_addr=$2
    local amount=$3
    local recipient=$4
    local name=$5
    
    warn "$name spending $amount..."
    local tx=$(send_tx $AAM_ADDRESS "spend(address,uint256,address)" \
        $parent_addr $amount $recipient \
        --rpc-url $RPC --private-key $child_key)
    log "Spend TX ($name): $tx"
    echo "$tx" >> tx_hashes.txt
}

# Main
main() {
    check_prereqs
    
    echo "AAM Hierarchy Deployment"
    echo "========================"
    echo "AAM: $AAM_ADDRESS"
    echo "USDC: $USDC_ADDRESS"
    echo "RPC: $RPC"
    echo ""
    
    # Clear previous tx hashes
    > tx_hashes.txt
    
    # Run phases based on arguments
    case "${1:-all}" in
        1|root)
            phase1_root_setup
            ;;
        all)
            echo "Running full deployment..."
            echo "Edit this script to customize the hierarchy."
            echo ""
            echo "Example hierarchy in .plan_cache/aam-test-hierarchy.md"
            ;;
        *)
            echo "Usage: $0 [1|root|all]"
            echo "  1/root  - Phase 1 only (root setup)"
            echo "  all     - Full deployment (customize script first)"
            ;;
    esac
    
    echo ""
    echo "TX hashes saved to tx_hashes.txt"
}

main "$@"
