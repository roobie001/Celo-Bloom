# Celo Bloom

Mini App for Celo Proof of Ship. Users grow a tree by making daily onchain actions (water, sunlight, reward claim).

## What’s Included

- React + Vite mobile-first UI
- MiniPay-aware wallet hook
- Celo Mainnet viem client
- Solidity contract for streaks, growth, sunlight, and rewards
- Hardhat deploy script


## Notes

- Daily watering is enforced onchain by UTC day boundaries.
- Rewards are micro cUSD and paid from the contract’s balance.
- Leaderboard is seeded locally; connect a backend later for global rankings.
