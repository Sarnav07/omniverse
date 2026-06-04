// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    uint256 public override priceWad;

    constructor(uint256 priceWad_) {
        priceWad = priceWad_;
    }

    function setPrice(uint256 priceWad_) external {
        priceWad = priceWad_;
    }
}
