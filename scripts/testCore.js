const hre = require("hardhat");

const CELO_BLOOM_ABI = [
  "function waterTree()",
  "function sendSunlight(address to)",
  "function claimReward()",
  "function setStreakForTesting(address userAddress, uint256 streak)",
  "function users(address user) view returns (uint32,uint64,uint32,uint32,uint32,uint32,uint64)",
];

const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

async function main() {
  const contractAddress = process.env.CELO_BLOOM_ADDRESS;
  const cUsdAddress = process.env.CUSD_ADDRESS;
  const sunlightTo = process.env.SUNLIGHT_TO || "0x000000000000000000000000000000000000dEaD";
  const fundAmount = process.env.FUND_AMOUNT || "5000000000000000";

  if (!contractAddress) throw new Error("Missing CELO_BLOOM_ADDRESS env var");
  if (!cUsdAddress) throw new Error("Missing CUSD_ADDRESS env var");

  const [signer] = await hre.ethers.getSigners();
  console.log("Using signer:", await signer.getAddress());

  const bloom = new hre.ethers.Contract(contractAddress, CELO_BLOOM_ABI, signer);
  const cUsd = new hre.ethers.Contract(cUsdAddress, ERC20_ABI, signer);

  console.log("Funding contract with cUSD...");
  const fundTx = await cUsd.transfer(contractAddress, fundAmount);
  await fundTx.wait();
  console.log("Funded:", fundTx.hash);

  console.log("Calling waterTree...");
  const waterTx = await bloom.waterTree();
  await waterTx.wait();
  console.log("waterTree tx:", waterTx.hash);

  console.log("Calling sendSunlight...");
  const sunTx = await bloom.sendSunlight(sunlightTo);
  await sunTx.wait();
  console.log("sendSunlight tx:", sunTx.hash);

  const user = await bloom.users(await signer.getAddress());
  const streak = Number(user[0]);
  const lastClaimedWeek = Number(user[6]);
  const nowWeek = Math.floor(Date.now() / 1000 / (7 * 24 * 60 * 60));

  if (streak < 3) {
    console.log("Setting streak to 3 for test eligibility...");
    const setTx = await bloom.setStreakForTesting(await signer.getAddress(), 3);
    await setTx.wait();
  }

  const refreshed = await bloom.users(await signer.getAddress());
  const refreshedStreak = Number(refreshed[0]);
  const refreshedLastClaimed = Number(refreshed[6]);
  if (refreshedStreak >= 3 && refreshedLastClaimed < nowWeek) {
    console.log("Calling claimReward...");
    const claimTx = await bloom.claimReward();
    await claimTx.wait();
    console.log("claimReward tx:", claimTx.hash);
  } else {
    console.log(
      "Skipping claimReward: not eligible yet (needs >=3 day streak and not claimed this week)."
    );
  }

  const updated = await bloom.users(await signer.getAddress());
  console.log("User state:", updated);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
