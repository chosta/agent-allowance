// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/**
 * @title Agent Allowance Manager (AAM)
 * @notice Enables parents (humans/agents) to give children (agents) USDC spending allowances with rate limits
 * @dev "Stripe Issuing for AI Agents" - recurring rate limits, API-first design
 */
contract AAM {
    // ============ Enums ============

    /// @notice Type of allowance
    enum AllowanceType {
        CAP,    // Periodic reset (e.g., 100 USDC/week)
        STREAM  // Continuous drip over time
    }

    /// @notice Status of an allowance
    enum Status {
        None,    // No allowance exists
        Active,  // Can spend
        Paused,  // Temporarily disabled
        Revoked  // Permanently disabled
    }

    // ============ Structs ============

    /// @notice Allowance configuration and state
    struct Allowance {
        address parent;          // Who created this allowance
        AllowanceType aType;     // CAP or STREAM
        uint256 limit;           // Amount per period (CAP) or total drip amount (STREAM)
        uint256 period;          // Period length in seconds
        uint256 spent;           // Amount spent in current period (CAP) or total spent (STREAM)
        uint256 lastReset;       // Timestamp of last reset (CAP) or creation time (STREAM)
        Status status;           // Current status
    }

    // ============ State ============

    /// @notice The USDC token contract
    IERC20 public immutable usdc;

    /// @notice Parent balances (deposited USDC)
    mapping(address => uint256) public balanceOf;

    /// @notice Allowances: parent => child => Allowance
    mapping(address => mapping(address => Allowance)) private allowances;

    // ============ Events ============

    event Deposit(address indexed parent, uint256 amount);
    event Withdraw(address indexed parent, uint256 amount);
    event AllowanceCreated(
        address indexed parent,
        address indexed child,
        AllowanceType aType,
        uint256 limit,
        uint256 period
    );
    event Spent(address indexed parent, address indexed child, address indexed recipient, uint256 amount);
    event Paused(address indexed parent, address indexed child);
    event Unpaused(address indexed parent, address indexed child);
    event Revoked(address indexed parent, address indexed child);

    // ============ Constructor ============

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ============ Deposit Functions ============

    /**
     * @notice Deposit USDC into the AAM (requires prior approval)
     * @param amount Amount of USDC to deposit
     */
    function deposit(uint256 amount) external {
        require(usdc.transferFrom(msg.sender, address(this), amount), "AAM: transfer failed");
        balanceOf[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Deposit USDC using EIP-2612 permit (single transaction)
     * @param amount Amount of USDC to deposit
     * @param deadline Permit deadline timestamp
     * @param v Signature v
     * @param r Signature r
     * @param s Signature s
     */
    function depositWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Call permit on USDC
        (bool success,) = address(usdc).call(
            abi.encodeWithSignature(
                "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
                msg.sender,
                address(this),
                amount,
                deadline,
                v,
                r,
                s
            )
        );
        require(success, "AAM: permit failed");

        // Then transfer
        require(usdc.transferFrom(msg.sender, address(this), amount), "AAM: transfer failed");
        balanceOf[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC from the AAM
     * @param amount Amount of USDC to withdraw
     */
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "AAM: insufficient balance");
        balanceOf[msg.sender] -= amount;
        require(usdc.transfer(msg.sender, amount), "AAM: transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    // ============ Allowance Management ============

    /**
     * @notice Create an allowance for a child agent
     * @param child Address of the child agent
     * @param aType Type of allowance (CAP or STREAM)
     * @param limit Spending limit per period
     * @param period Period length in seconds
     */
    function createAllowance(
        address child,
        AllowanceType aType,
        uint256 limit,
        uint256 period
    ) external {
        require(balanceOf[msg.sender] >= limit, "AAM: insufficient balance");
        require(allowances[msg.sender][child].status == Status.None, "AAM: allowance exists");
        require(period > 0, "AAM: period must be positive");
        require(limit > 0, "AAM: limit must be positive");

        allowances[msg.sender][child] = Allowance({
            parent: msg.sender,
            aType: aType,
            limit: limit,
            period: period,
            spent: 0,
            lastReset: block.timestamp,
            status: Status.Active
        });

        emit AllowanceCreated(msg.sender, child, aType, limit, period);
    }

    /**
     * @notice Pause an allowance (temporarily disable spending)
     * @param child Address of the child agent
     */
    function pause(address child) external {
        Allowance storage a = allowances[msg.sender][child];
        require(a.status == Status.Active, "AAM: not active");
        a.status = Status.Paused;
        emit Paused(msg.sender, child);
    }

    /**
     * @notice Unpause an allowance
     * @param child Address of the child agent
     */
    function unpause(address child) external {
        Allowance storage a = allowances[msg.sender][child];
        require(a.status == Status.Paused, "AAM: not paused");
        a.status = Status.Active;
        emit Unpaused(msg.sender, child);
    }

    /**
     * @notice Revoke an allowance permanently
     * @param child Address of the child agent
     */
    function revoke(address child) external {
        Allowance storage a = allowances[msg.sender][child];
        require(a.status != Status.None && a.status != Status.Revoked, "AAM: no allowance");
        a.status = Status.Revoked;
        emit Revoked(msg.sender, child);
    }

    // ============ Spending ============

    /**
     * @notice Spend from allowance (called by child agent)
     * @param parent Address of the parent who created the allowance
     * @param amount Amount to spend
     * @param recipient Address to receive the USDC
     */
    function spend(address parent, uint256 amount, address recipient) external {
        Allowance storage a = allowances[parent][msg.sender];
        
        require(a.status != Status.None && a.status != Status.Revoked, "AAM: no allowance");
        require(a.status != Status.Paused, "AAM: allowance paused");

        uint256 available = _getAvailable(a);
        require(amount <= available, "AAM: exceeds allowance");
        require(balanceOf[parent] >= amount, "AAM: parent insufficient balance");

        // Update state
        if (a.aType == AllowanceType.CAP) {
            // Check if we need to reset period
            if (block.timestamp >= a.lastReset + a.period) {
                a.spent = 0;
                a.lastReset = block.timestamp;
            }
            a.spent += amount;
        } else {
            // STREAM: just track total spent
            a.spent += amount;
        }

        // Deduct from parent balance and transfer
        balanceOf[parent] -= amount;
        require(usdc.transfer(recipient, amount), "AAM: transfer failed");

        emit Spent(parent, msg.sender, recipient, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get allowance details
     * @param parent Parent address
     * @param child Child address
     * @return parent_ Parent address
     * @return aType Allowance type
     * @return limit Spending limit
     * @return period Period length
     * @return spent Amount spent
     * @return lastReset Last reset timestamp
     * @return status Current status
     */
    function getAllowance(address parent, address child) external view returns (
        address parent_,
        AllowanceType aType,
        uint256 limit,
        uint256 period,
        uint256 spent,
        uint256 lastReset,
        Status status
    ) {
        Allowance storage a = allowances[parent][child];
        return (a.parent, a.aType, a.limit, a.period, a.spent, a.lastReset, a.status);
    }

    /**
     * @notice Get available spending amount for a child
     * @param parent Parent address
     * @param child Child address
     * @return available Amount available to spend
     */
    function getAvailable(address parent, address child) external view returns (uint256 available) {
        Allowance storage a = allowances[parent][child];
        if (a.status != Status.Active) return 0;
        return _getAvailable(a);
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate available spending amount (lazy reset logic)
     * @param a Allowance storage reference
     * @return available Amount available to spend
     */
    function _getAvailable(Allowance storage a) internal view returns (uint256 available) {
        if (a.aType == AllowanceType.CAP) {
            // CAP: Reset if period has passed
            uint256 effectiveSpent = a.spent;
            if (block.timestamp >= a.lastReset + a.period) {
                effectiveSpent = 0; // Would reset
            }
            return a.limit - effectiveSpent;
        } else {
            // STREAM: Calculate drip based on elapsed time
            uint256 elapsed = block.timestamp - a.lastReset;
            uint256 totalDripped = (a.limit * elapsed) / a.period;
            if (totalDripped > a.limit) totalDripped = a.limit; // Cap at limit
            if (totalDripped <= a.spent) return 0;
            return totalDripped - a.spent;
        }
    }
}
