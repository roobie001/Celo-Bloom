# Celo Bloom

Mini App for Celo Proof of Ship. Users grow a tree by making daily onchain actions (water, sunlight, reward claim).

## What’s Included

- React + Vite mobile-first UI
- MiniPay-aware wallet hook
- Celo Mainnet viem client
- Solidity contract for streaks, growth, sunlight, and rewards
- Hardhat deploy script

## Env Vars

Create a `.env` file in the project root:

```bash
VITE_CELO_BLOOM_ADDRESS=0xYourDeployedContract
VITE_CELO_RPC_URL=https://forno.celo.org

# Contract deploy (Hardhat)
ALFAJORES_RPC_URL=https://alfajores-forno.celo-testnet.org
CELO_RPC_URL=https://forno.celo.org
DEPLOYER_KEY=0xYourPrivateKey
CUSD_ADDRESS=0xYourcUSDToken
REWARD_AMOUNT=1000000000000000
CELO_BLOOM_ADDRESS=0xYourDeployedContract
SUNLIGHT_TO=0x000000000000000000000000000000000000dEaD
FUND_AMOUNT=5000000000000000
```

## Run the App

```bash
npm install
npm run dev
```

## Deploy the Contract

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network celo
```

After deployment, set `VITE_CELO_BLOOM_ADDRESS` in `.env` and restart the dev server.

## Alfajores Test Flow

```bash
npx hardhat compile
npm run deploy:alfajores
npm run test:alfajores
```

Note: `setStreakForTesting` is included for Alfajores only. Remove it before Mainnet deploy.

## Notes

- Daily watering is enforced onchain by UTC day boundaries.
- Rewards are micro cUSD and paid from the contract’s balance.
- Leaderboard is seeded locally; connect a backend later for global rankings.
