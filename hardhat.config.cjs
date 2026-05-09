require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

const celoRpc = process.env.CELO_RPC_URL || "https://forno.celo.org";
const alfajoresRpc =
  process.env.ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org";
const deployerKey = process.env.DEPLOYER_KEY || "";

module.exports = {
  solidity: "0.8.20",
  networks: {
    alfajores: {
      url: process.env.ALFAJORES_RPC_URL || "https://forno.celo-testnet.org",
      chainId: 11142220,
      accounts: deployerKey ? [deployerKey] : [],
    },
    celo: {
      url: celoRpc,
      chainId: 42220,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};
