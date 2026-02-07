// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AAM.sol";

/// @title DeployAAM
/// @notice Deployment script for Agent Allowance Manager
/// @dev Usage: USDC_ADDRESS=0x... PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract DeployAAM is Script {
    function run() external {
        // USDC addresses by network:
        // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
        // Arc Testnet: Check Circle docs for latest address

        address usdc = vm.envOr("USDC_ADDRESS", address(0x036CbD53842c5426634e7929541eC2318f3dCF7e));
        require(usdc != address(0), "USDC address required");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        AAM aam = new AAM(usdc);

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("AAM deployed to:", address(aam));
        console.log("USDC address:", usdc);
        console.log("===========================");
    }
}
