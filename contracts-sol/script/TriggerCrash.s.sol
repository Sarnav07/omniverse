// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {Resolver} from "../src/Resolver.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";

/// @notice Resolves the event to NO (Crashing YES prices to 0) and settles the lending pool.
contract TriggerCrash is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        address resolverAddr = vm.envAddress("RESOLVER_ADDRESS");
        bytes32 questionId = vm.envBytes32("QUESTION_ID");
        address lendingAddr = vm.envAddress("LENDING_ADDRESS");

        Resolver resolver = Resolver(resolverAddr);
        MultiverseLending lending = MultiverseLending(lendingAddr);

        vm.startBroadcast(deployerKey);

        console.log("Resolving question to NO...");
        // Set payouts for NO to win (YES=0, NO=1)
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 0;
        payouts[1] = 1;
        resolver.resolve(questionId, payouts);
        console.log("Question resolved!");

        console.log("Settling Lending Contract...");
        lending.settle();
        console.log("Lending Contract settled! All YES positions are wiped out, Lenders absorb NO.");

        vm.stopBroadcast();
    }
}
