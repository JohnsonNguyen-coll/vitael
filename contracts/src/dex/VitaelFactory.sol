// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelPair.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title VitaelFactory — creates and tracks all VitaelPair contracts
contract VitaelFactory is Ownable, Pausable {
    /// @notice Treasury address that receives protocol fees
    address public treasury;

    /// @notice Protocol fee in basis points taken from each swap (default 30 = 0.3%)
    /// @dev Fee is split: LP fee stays in pool, protocol fee goes to treasury
    /// @dev protocolFeeBps is the portion sent to treasury (out of total 30bps swap fee)
    uint256 public protocolFeeBps = 5; // 0.05% to treasury, rest to LPs

    // token0 => token1 => pair
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address _owner, address _treasury) Ownable(_owner) {
        require(_treasury != address(0), "VitaelFactory: ZERO_TREASURY");
        treasury = _treasury;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Deploy a new pair contract for tokenA/tokenB
    function createPair(address tokenA, address tokenB) external whenNotPaused returns (address pair) {
        require(tokenA != tokenB, "VitaelFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "VitaelFactory: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "VitaelFactory: PAIR_EXISTS");

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        VitaelPair p = new VitaelPair{salt: salt}();
        p.initialize(token0, token1);

        pair = address(p);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Update treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "VitaelFactory: ZERO_ADDRESS");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @notice Update protocol fee (max 10bps = 0.1%)
    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 10, "VitaelFactory: FEE_TOO_HIGH");
        emit ProtocolFeeUpdated(protocolFeeBps, _feeBps);
        protocolFeeBps = _feeBps;
    }

    /// @notice Pause all pair creation and swaps
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }
}
