// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {AAM} from "../src/AAM.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract AAMTest is Test {
    AAM public aam;
    MockUSDC public usdc;

    address public parent = address(0x1);
    address public child = address(0x2);
    address public stranger = address(0x3);

    uint256 public parentPk = 0xA11CE;
    address public parentSigner;

    function setUp() public {
        usdc = new MockUSDC();
        aam = new AAM(address(usdc));

        parentSigner = vm.addr(parentPk);

        // Fund parent with USDC
        usdc.mint(parent, 10_000e6);
        usdc.mint(parentSigner, 10_000e6);
    }

    // ============ createAllowance Tests ============

    function test_createAllowance_setsCorrectParameters() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);

        aam.createAllowance(
            child,
            AAM.AllowanceType.CAP,
            100e6, // limit per period
            1 weeks // period
        );

        (
            address allowanceParent,
            AAM.AllowanceType allowanceType,
            uint256 limit,
            uint256 period,
            uint256 spent,
            uint256 lastReset,
            AAM.Status status
        ) = aam.getAllowance(parent, child);

        assertEq(allowanceParent, parent);
        assertEq(uint8(allowanceType), uint8(AAM.AllowanceType.CAP));
        assertEq(limit, 100e6);
        assertEq(period, 1 weeks);
        assertEq(spent, 0);
        assertEq(lastReset, block.timestamp);
        assertEq(uint8(status), uint8(AAM.Status.Active));
        vm.stopPrank();
    }

    function test_createAllowance_emitsEvent() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);

        vm.expectEmit(true, true, false, true);
        emit AAM.AllowanceCreated(parent, child, AAM.AllowanceType.CAP, 100e6, 1 weeks);

        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();
    }

    function test_createAllowance_revertsIfNotParent() public {
        // Stranger tries to create allowance without deposit
        vm.prank(stranger);
        vm.expectRevert("AAM: insufficient balance");
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
    }

    function test_createAllowance_revertsIfAllowanceExists() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);

        vm.expectRevert("AAM: allowance exists");
        aam.createAllowance(child, AAM.AllowanceType.CAP, 50e6, 1 days);
        vm.stopPrank();
    }

    // ============ deposit Tests ============

    function test_deposit_increasesBalance() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 500e6);

        uint256 balanceBefore = aam.balanceOf(parent);
        aam.deposit(500e6);
        uint256 balanceAfter = aam.balanceOf(parent);

        assertEq(balanceAfter - balanceBefore, 500e6);
        vm.stopPrank();
    }

    function test_deposit_emitsEvent() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 500e6);

        vm.expectEmit(true, false, false, true);
        emit AAM.Deposit(parent, 500e6);

        aam.deposit(500e6);
        vm.stopPrank();
    }

    function test_deposit_revertsIfNoApproval() public {
        vm.prank(parent);
        vm.expectRevert();
        aam.deposit(500e6);
    }

    // ============ depositWithPermit Tests ============

    function test_depositWithPermit_singleTransaction() public {
        uint256 amount = 500e6;
        uint256 deadline = block.timestamp + 1 hours;

        // Sign permit
        bytes32 structHash = keccak256(
            abi.encode(usdc.PERMIT_TYPEHASH(), parentSigner, address(aam), amount, usdc.nonces(parentSigner), deadline)
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(parentPk, hash);

        uint256 balanceBefore = aam.balanceOf(parentSigner);

        vm.prank(parentSigner);
        aam.depositWithPermit(amount, deadline, v, r, s);

        uint256 balanceAfter = aam.balanceOf(parentSigner);
        assertEq(balanceAfter - balanceBefore, amount);
    }

    // ============ spend Tests ============

    function test_spend_deductsFromAllowance() public {
        // Setup allowance
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        // Child spends
        vm.prank(child);
        aam.spend(parent, 50e6, child);

        // Check child received USDC
        assertEq(usdc.balanceOf(child), 50e6);

        // Check spent amount recorded
        (,,,, uint256 spent,,) = aam.getAllowance(parent, child);
        assertEq(spent, 50e6);
    }

    function test_spend_revertsIfOverLimit() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        vm.prank(child);
        vm.expectRevert("AAM: exceeds allowance");
        aam.spend(parent, 150e6, child);
    }

    function test_spend_revertsIfPaused() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        aam.pause(child);
        vm.stopPrank();

        vm.prank(child);
        vm.expectRevert("AAM: allowance paused");
        aam.spend(parent, 50e6, child);
    }

    function test_spend_resetsAfterPeriod() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        // Child spends full allowance
        vm.prank(child);
        aam.spend(parent, 100e6, child);

        // Can't spend more
        vm.prank(child);
        vm.expectRevert("AAM: exceeds allowance");
        aam.spend(parent, 1e6, child);

        // Warp past period
        vm.warp(block.timestamp + 1 weeks + 1);

        // Now can spend again
        vm.prank(child);
        aam.spend(parent, 50e6, child);

        assertEq(usdc.balanceOf(child), 150e6);
    }

    function test_spend_dripsCorrectly() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        // STREAM: 100 USDC per week = ~14.28 USDC per day
        aam.createAllowance(child, AAM.AllowanceType.STREAM, 100e6, 1 weeks);
        vm.stopPrank();

        // Initially 0 available (just created)
        vm.prank(child);
        vm.expectRevert("AAM: exceeds allowance");
        aam.spend(parent, 1e6, child);

        // After 1 day, should have ~14.28 USDC
        vm.warp(block.timestamp + 1 days);

        vm.prank(child);
        aam.spend(parent, 14e6, child); // Slightly less than 14.28

        // After full week, should have remaining amount
        vm.warp(block.timestamp + 6 days);

        vm.prank(child);
        aam.spend(parent, 85e6, child); // Total near 100
    }

    function test_spend_emitsEvent() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        vm.prank(child);
        vm.expectEmit(true, true, true, true);
        emit AAM.Spent(parent, child, child, 50e6);
        aam.spend(parent, 50e6, child);
    }

    // ============ pause Tests ============

    function test_pause_preventsSpending() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);

        vm.expectEmit(true, true, false, true);
        emit AAM.Paused(parent, child);
        aam.pause(child);
        vm.stopPrank();

        vm.prank(child);
        vm.expectRevert("AAM: allowance paused");
        aam.spend(parent, 50e6, child);
    }

    function test_pause_canUnpause() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        aam.pause(child);
        aam.unpause(child);
        vm.stopPrank();

        vm.prank(child);
        aam.spend(parent, 50e6, child);
        assertEq(usdc.balanceOf(child), 50e6);
    }

    // ============ revoke Tests ============

    function test_revoke_removesAllowance() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);

        vm.expectEmit(true, true, false, false);
        emit AAM.Revoked(parent, child);
        aam.revoke(child);
        vm.stopPrank();

        // Child can no longer spend
        vm.prank(child);
        vm.expectRevert("AAM: no allowance");
        aam.spend(parent, 50e6, child);
    }

    function test_revoke_onlyParentCanRevoke() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert("AAM: no allowance");
        aam.revoke(child);
    }

    // ============ Fuzz Tests ============

    function testFuzz_deposit_anyAmount(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);

        usdc.mint(parent, amount);
        vm.startPrank(parent);
        usdc.approve(address(aam), amount);
        aam.deposit(amount);
        vm.stopPrank();

        assertEq(aam.balanceOf(parent), amount);
    }

    function testFuzz_spend_withinLimit(uint256 spendAmount) public {
        uint256 limit = 100e6;
        spendAmount = bound(spendAmount, 1, limit);

        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, limit, 1 weeks);
        vm.stopPrank();

        vm.prank(child);
        aam.spend(parent, spendAmount, child);

        assertEq(usdc.balanceOf(child), spendAmount);
    }

    // ============ Edge Cases ============

    function test_spend_toRecipientNotChild() public {
        address recipient = address(0x999);

        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);
        aam.createAllowance(child, AAM.AllowanceType.CAP, 100e6, 1 weeks);
        vm.stopPrank();

        // Child spends to different recipient
        vm.prank(child);
        aam.spend(parent, 50e6, recipient);

        assertEq(usdc.balanceOf(recipient), 50e6);
        assertEq(usdc.balanceOf(child), 0);
    }

    function test_withdraw_parentCanWithdraw() public {
        vm.startPrank(parent);
        usdc.approve(address(aam), 1000e6);
        aam.deposit(1000e6);

        uint256 balanceBefore = usdc.balanceOf(parent);
        aam.withdraw(500e6);
        uint256 balanceAfter = usdc.balanceOf(parent);

        assertEq(balanceAfter - balanceBefore, 500e6);
        assertEq(aam.balanceOf(parent), 500e6);
        vm.stopPrank();
    }
}
