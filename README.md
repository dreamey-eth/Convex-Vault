# ConvexVault

ConvexVault is a Solidity smart contract that allows users to deposit LP (Liquidity Provider) tokens into Convex Finance pools, earn rewards in CRV (Curve Finance) and CVX (Convex Finance native token), and claim those rewards.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Adding a New Pool](#adding-a-new-pool)
  - [Depositing LP Tokens](#depositing-lp-tokens)
  - [Withdrawing LP Tokens](#withdrawing-lp-tokens)
  - [Claiming Rewards](#claiming-rewards)
- [Contributing](#contributing)
- [License](#license)

## Overview

The ConvexVault contract is designed to interact with Convex Finance and facilitate the management of LP tokens in Convex Finance pools. Users can deposit and withdraw LP tokens, claim CRV and CVX rewards, and check their earned rewards.

## Prerequisites

Before using this contract, make sure you have the following:

- A compatible Ethereum wallet (e.g., MetaMask)
- LP tokens from Convex Finance pools
- CRV and CVX tokens

## Installation

No installation is required for end users. Developers can deploy the contract to the Ethereum blockchain using a development environment like Hardhat.

## Usage

### Adding a New Pool

Only the contract owner can add a new pool. To add a pool, use the `addPool` function by specifying the allocation points, LP token address, and Convex pool ID.

```solidity
function addPool(
    uint256 _allocPoint,
    address _lpToken,
    uint256 _pid
) public onlyOwner;
```

### Depositing LP Tokens

Users can deposit LP tokens into ConvexVault using the `deposit` function. Specify the pool ID and the amount of LP tokens to deposit.

```solidity
function deposit(uint256 _pid, uint256 _amount) public;
```

### Withdrawing LP Tokens

Users can withdraw LP tokens from ConvexVault using the `withdraw` function. Specify the pool ID and the amount of LP tokens to withdraw.

```solidity
function withdraw(uint256 _pid, uint256 _amount) public;
```

### Claiming Rewards

Users can claim their earned CRV and CVX rewards using the `claim` function. Specify the pool ID and the user's address.

```solidity
function claim(uint256 _pid, address _account) public;
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.