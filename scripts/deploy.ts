import { ethers } from "hardhat";

async function main() {
  const ConvexVault = await ethers.getContractFactory("ConvexVault");
  const convexVault = await ConvexVault.deploy();

  await convexVault.deployed();

  // Curve cDAI/cUSDC LP Pool (Convex Pid : 0)
  const tx = await convexVault.add(100, "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2", 0);
  await tx.wait();

  console.log(`ConvexVault deployed to ${convexVault.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
