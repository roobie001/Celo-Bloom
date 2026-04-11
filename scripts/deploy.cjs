const hre = require("hardhat");

async function main() {
  const cUsdAddress = process.env.CUSD_ADDRESS;
  const rewardAmount = process.env.REWARD_AMOUNT || "1000000000000000";

  if (!cUsdAddress) {
    throw new Error("Missing CUSD_ADDRESS env var");
  }

  const CeloBloom = await hre.ethers.getContractFactory("CeloBloom");
  const contract = await CeloBloom.deploy(cUsdAddress, rewardAmount);

  await contract.waitForDeployment();
  console.log("CeloBloom deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
