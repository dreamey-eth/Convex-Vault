// SPDX-License-Identifier: BUSL-1.1

import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { Contract } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";
import { mine, time } from "@nomicfoundation/hardhat-network-helpers";

describe("ConvexVault Test", function () {
  let convexVault: Contract;
  let lpToken: Contract;
  let signer0: Signer, signer1: Signer;
  let cvxToken: Contract;
  let crvToken: Contract;
  let Booster: Contract;

  beforeEach(async function () {
    const lpTokenAddress = "0xC25a3A3b969415c80451098fa907EC722572917F";
    const crvTokenAddress = "0xD533a949740bb3306d119CC777fa900bA034cd52";
    const cvxTokenAddress = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
    const Vault = await ethers.getContractFactory("ConvexVault");
    const convexPid = 4;
    convexVault = await Vault.deploy();

    await convexVault.deployed();

    console.log(`ConvexVault deployed to ${convexVault.address}`);

    await convexVault.addPool(100, lpTokenAddress, convexPid);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x9E51BE7071F086d3A1fD5Dc0016177473619b237"],
    });
    signer0 = await ethers.getSigner("0x9E51BE7071F086d3A1fD5Dc0016177473619b237");

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x76182bA866Fc44bffC2A4096B332aC7A799eE3Dc"],
    });
    signer1 = await ethers.getSigner("0x76182bA866Fc44bffC2A4096B332aC7A799eE3Dc");


    console.log("LP Token Address: ", lpTokenAddress);
    lpToken = await ethers.getContractAt("MockERC20", lpTokenAddress);
    crvToken = await ethers.getContractAt("MockERC20", crvTokenAddress);
    cvxToken = await ethers.getContractAt("MockERC20", cvxTokenAddress);

    Booster = await ethers.getContractAt("IBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
    await Booster.connect(signer1).earmarkRewards(convexPid);
  });

  it('Should calculate rewards correctly without vault claim', async () => {
    const pid = 0;
    const amount = parseEther("10");
    const signerAddress = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount);
    console.log("Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount));

    // Get calculated rewards
    const rewards = await convexVault.calculateRewardsEarned(signerAddress, pid);

    await time.increase(18000);
    await mine();
    // Get updated rewards
    const updatedRewards = await convexVault.calculateRewardsEarned(signerAddress, pid);
    expect(updatedRewards[0]).to.be.not.equal(rewards[0]);
    expect(updatedRewards[1]).to.be.not.equal(rewards[1]);
    console.log("CRV Token Reward: ", formatEther(updatedRewards[0]));
    console.log("CVX Token Reward: ", formatEther(updatedRewards[1]));
    console.log("Confirmed rewards were genereated without getVaultRewards");
  }).timeout(300000);

  it('Should add a new pool', async function () {
    const allocPoint = 100;
    const lpToken = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
    await convexVault.addPool(allocPoint, lpToken, 0);

    const poolLength = await convexVault.poolLength();
    expect(poolLength).to.equal(2);

    const poolInfo = await convexVault.poolInfo(1);
    expect(poolInfo.lpToken).to.equal(lpToken);
    expect(poolInfo.allocPoint).to.equal(allocPoint);
  });

  it('Should revert on wrong LP token address', async function () {
    const allocPoint = 100;
    const lpToken = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
    await expect(convexVault.addPool(allocPoint, lpToken, 1)).to.be.revertedWith("Wrong Pid for Convex");
  });


  it('Should deposit and withdraw tokens', async () => {
    const pid = 0;
    const amount = parseEther("10");
    const signerAddress = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount);
    console.log("Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount));
    // Check if the tokens were deposited
    const userInfo = await convexVault.userInfo(pid, signerAddress);
    expect(userInfo.amount.toString()).to.be.equal(amount.toString());

    await convexVault.connect(signer0).withdraw(pid, amount);
    console.log("Withdrawn from ConvexVault: ", formatEther(amount));
    // Check if the tokens were withdrawn
    const userInfoAfterWithdraw = await convexVault.userInfo(pid, signerAddress);
    expect(userInfoAfterWithdraw.amount).to.be.equal(0);
  }).timeout(300000);

  it('Should calculate rewards correctly', async () => {
    const pid = 0;
    const amount = parseEther("10");
    const signerAddress = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount);
    console.log("Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount));

    // Get calculated rewards
    const rewards = await convexVault.calculateRewardsEarned(signerAddress, pid);
    expect(rewards[0]).to.be.equal((0));
    expect(rewards[1]).to.be.equal((0));

    await time.increase(18000);
    // Update rewards
    await convexVault.connect(signer0).getVaultRewards(pid);

    // Get updated rewards
    const updatedRewards = await convexVault.calculateRewardsEarned(signerAddress, pid);
    expect(updatedRewards[0].toString()).to.be.not.equal("0");
    expect(updatedRewards[1].toString()).to.be.not.equal("0");

    console.log("Confirmed rewards were genereated");
  }).timeout(300000);

  it('Should claim rewards correctly', async () => {
    const pid = 0;
    const amount = parseEther("10");
    const signerAddress = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount);
    console.log("Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount));

    // Get calculated rewards
    const rewards = await convexVault.calculateRewardsEarned(signerAddress, pid);
    expect(rewards[0]).to.be.equal((0));
    expect(rewards[1]).to.be.equal((0));

    // Increaes 1 month
    await time.increase(3600 * 24 * 30);
    await convexVault.connect(signer0).getVaultRewards(pid);

    // Claim rewards
    await convexVault.connect(signer0).claim(pid, signerAddress);
    const crvReward = await crvToken.balanceOf(signerAddress);
    const cvxReward = await cvxToken.balanceOf(signerAddress);

    console.log("CRV Token Reward: ", formatEther(crvReward));
    console.log("CVX Token Reward: ", formatEther(cvxReward));
    // Check if rewards were claimed properly
    // Write assertions based on the specific logic of the `claim` function
  }).timeout(300000);

  it('Should receive correct reward based on the staked amount', async () => {
    const pid = 0;
    const amount0 = parseEther("10");
    const amount1 = parseEther("100");
    const signer0Address = await signer0.getAddress();
    const signer1Address = await signer1.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount0);
    await lpToken.connect(signer1).approve(convexVault.address, amount1);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount0);
    await convexVault.connect(signer1).deposit(pid, amount1);
    console.log("User 1 : Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount0));
    console.log("User 2 : Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount1));

    // Increaes 1 month
    await time.increase(18000);
    await convexVault.connect(signer0).getVaultRewards(pid);

    // Claim rewards
    let crvReward0 = await crvToken.balanceOf(signer0Address);
    let cvxReward0 = await cvxToken.balanceOf(signer0Address);
    await convexVault.connect(signer0).claim(pid, signer0Address);
    crvReward0 = await crvToken.balanceOf(signer0Address) - crvReward0;
    cvxReward0 = await cvxToken.balanceOf(signer0Address) - cvxReward0;

    let crvReward1 = await crvToken.balanceOf(signer1Address);
    let cvxReward1 = await cvxToken.balanceOf(signer1Address);
    await convexVault.connect(signer1).claim(pid, signer1Address);
    crvReward1 = await crvToken.balanceOf(signer1Address) - crvReward1;
    cvxReward1 = await cvxToken.balanceOf(signer1Address) - cvxReward1;

    expect(crvReward0).to.be.within(crvReward1 / 10 * 0.99, crvReward1 / 10 * 1.01);
    expect(cvxReward0).to.be.within(cvxReward1 / 10 * 0.99, cvxReward1 / 10 * 1.01);
    // Check if rewards were claimed properly
    // Write assertions based on the specific logic of the `claim` function
  }).timeout(300000);

  it('Check reward distributed based on the staked amount', async () => {
    const pid = 0;
    const amount0 = parseEther("10");
    const signer0Address = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount0);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await convexVault.connect(signer0).deposit(pid, amount0);
    console.log("User 1 : Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount0));
    // Increaes 1 month
    await time.increase(18000);

    // Get calculated rewards
    const rewards0 = await convexVault.calculateRewardsEarned(signer0Address, pid);
    console.log("CRV Reward calculated : ", formatEther(rewards0[0]));
    console.log("CVX Reward calculated : ", formatEther(rewards0[1]));
    await convexVault.connect(signer0).getVaultRewards(pid);

    // Claim rewards
    let crvReward0 = await crvToken.balanceOf(signer0Address);
    let cvxReward0 = await cvxToken.balanceOf(signer0Address);
    await convexVault.connect(signer0).claim(pid, signer0Address);
    crvReward0 = await crvToken.balanceOf(signer0Address) - crvReward0;
    cvxReward0 = await cvxToken.balanceOf(signer0Address) - cvxReward0;
    console.log("CRV Reward received : ", formatEther(crvReward0));
    console.log("CVX Reward received : ", formatEther(cvxReward0));
    expect(crvReward0).to.be.within(rewards0[0] * 0.99, rewards0[0] * 1.01);
    expect(cvxReward0).to.be.within(rewards0[1] * 0.99, rewards0[1] * 1.01);
    // Check if rewards were claimed properly
    // Write assertions based on the specific logic of the `claim` function
  }).timeout(300000);

  it('Should check the events', async () => {
    const pid = 0;
    const amount0 = parseEther("10");
    const signer0Address = await signer0.getAddress();

    // Approve tokens
    await lpToken.connect(signer0).approve(convexVault.address, amount0);
    console.log("Approved LP tokens for staking");
    // Deposit tokens && Stake
    await expect(convexVault.connect(signer0).deposit(pid, amount0)).to.be.emit(convexVault, "Deposit").withArgs(signer0Address, pid, amount0);
    console.log("User 1 : Deposited into convexVault and stake in the BaseRewardPool: ", formatEther(amount0));
    // Increaes 1 month
    await time.increase(18000);

    // Get calculated rewards
    const rewards0 = await convexVault.calculateRewardsEarned(signer0Address, pid);
    console.log("CRV Reward calculated : ", formatEther(rewards0[0]));
    console.log("CVX Reward calculated : ", formatEther(rewards0[1]));
    await convexVault.connect(signer0).getVaultRewards(pid);

    await expect(convexVault.connect(signer0).withdraw(pid, amount0)).to.be.emit(convexVault, "Withdraw").withArgs(signer0Address, pid, amount0);
    // Check if rewards were claimed properly
    // Write assertions based on the specific logic of the `claim` function
  }).timeout(300000);
});
