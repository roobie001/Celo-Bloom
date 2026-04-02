import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { celo } from "viem/chains";
import { CELO_BLOOM_ABI } from "./abi/celoBloomAbi";
import { useMiniPay } from "./hooks/useMiniPay";
import { shortAddress } from "./utils/format";

const CELO_CHAIN_ID = 42220;
const DEFAULT_RPC = "https://forno.celo.org";

const contractAddress =
  import.meta.env.VITE_CELO_BLOOM_ADDRESS || "0x0000000000000000000000000000000000000000";
const rpcUrl = import.meta.env.VITE_CELO_RPC_URL || DEFAULT_RPC;

const milestoneLabels = {
  3: "Seedling",
  7: "Sapling",
  14: "Tree",
};

const initialLeaderboard = [
  { rank: 1, name: "0x81b9...31E2", streak: 14, growth: 4, txs: 52 },
  { rank: 2, name: "0x91D3...a9F1", streak: 9, growth: 3, txs: 38 },
  { rank: 3, name: "0xA2c1...00b8", streak: 7, growth: 3, txs: 31 },
  { rank: 4, name: "0x11F0...F00D", streak: 4, growth: 2, txs: 18 },
];

function getDayId(tsSeconds) {
  return Math.floor(tsSeconds / 86400);
}

function getWeekId(tsSeconds) {
  return Math.floor(tsSeconds / 604800);
}

function stageForGrowth(growthLevel) {
  if (growthLevel >= 4) return "tree";
  if (growthLevel >= 3) return "sapling";
  if (growthLevel >= 2) return "seedling";
  return "seed";
}

export default function App() {
  const { provider, address, chainId, status, connect } = useMiniPay();
  const [user, setUser] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [txHash, setTxHash] = useState("");
  const [sunlightTo, setSunlightTo] = useState("");
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: celo,
      transport: http(rpcUrl),
    });
  }, [rpcUrl]);

  const walletClient = useMemo(() => {
    if (!provider) return null;
    return createWalletClient({
      chain: celo,
      transport: custom(provider),
    });
  }, [provider]);

  const refreshUser = async () => {
    if (!address) return;
    try {
      const data = await publicClient.readContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "users",
        args: [address],
      });
      const parsed = {
        streakCount: Number(data.streakCount),
        lastWateredAt: Number(data.lastWateredAt),
        growthLevel: Number(data.growthLevel),
        totalActions: Number(data.totalActions),
        sunlightSent: Number(data.sunlightSent),
        sunlightReceived: Number(data.sunlightReceived),
        lastClaimedWeek: Number(data.lastClaimedWeek),
      };
      setUser(parsed);
      updateLeaderboard(parsed);
    } catch (error) {
      console.error(error);
    }
  };

  const updateLeaderboard = (latestUser) => {
    const score = latestUser.growthLevel * 10 + latestUser.totalActions + latestUser.streakCount;
    const entry = {
      rank: 0,
      name: shortAddress(address || "0x0"),
      streak: latestUser.streakCount,
      growth: latestUser.growthLevel,
      txs: latestUser.totalActions,
      score,
    };
    const merged = [...initialLeaderboard, entry]
      .filter((item) => item.name !== "0x0")
      .sort((a, b) => (b.score || b.txs) - (a.score || a.txs))
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    setLeaderboard(merged);
  };

  useEffect(() => {
    if (address) refreshUser();
  }, [address]);

  const todayId = getDayId(Math.floor(Date.now() / 1000));
  const lastWateredId = user?.lastWateredAt ? getDayId(user.lastWateredAt) : null;
  const alreadyWatered = lastWateredId === todayId;
  const isEligibleReward =
    user?.streakCount >= 3 && (user?.lastClaimedWeek || 0) < getWeekId(Math.floor(Date.now() / 1000));
  const currentStage = stageForGrowth(user?.growthLevel || 1);

  const ensureWalletReady = () => {
    if (!walletClient || !address) return false;
    return chainId === CELO_CHAIN_ID;
  };

  const handleWater = async () => {
    if (!ensureWalletReady()) return;
    setBusyAction("water");
    setTxHash("");
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "waterTree",
        account: address,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshUser();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction("");
    }
  };

  const handleSunlight = async () => {
    if (!ensureWalletReady()) return;
    if (!sunlightTo) return;
    setBusyAction("sunlight");
    setTxHash("");
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "sendSunlight",
        args: [sunlightTo],
        account: address,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshUser();
      setSunlightTo("");
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction("");
    }
  };

  const handleClaim = async () => {
    if (!ensureWalletReady()) return;
    setBusyAction("claim");
    setTxHash("");
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "claimReward",
        account: address,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshUser();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction("");
    }
  };

  const showConnect = status !== "connected";
  const chainWarning = address && chainId !== CELO_CHAIN_ID;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Celo Bloom</span>
          <span className="brand-tag">Proof of Ship Mini App</span>
        </div>
        <div className="wallet">
          {showConnect ? (
            <button className="btn btn-primary" onClick={connect}>
              Connect MiniPay
            </button>
          ) : (
            <div className="wallet-pill">
              <span>{shortAddress(address)}</span>
              <span className="wallet-status">Celo Mainnet</span>
            </div>
          )}
        </div>
      </header>

      <main className="grid">
        <section className="card hero">
          <div className="hero-left">
            <p className="eyebrow">Daily Quest</p>
            <h1>Grow your tree with one onchain action each day.</h1>
            <p className="subtext">
              Watering keeps your streak alive. Sunlight makes friends grow faster. Rewards are tiny but frequent.
            </p>

            <div className="cta-row">
              <button
                className="btn btn-accent"
                onClick={handleWater}
                disabled={busyAction || alreadyWatered || showConnect || chainWarning}
              >
                {alreadyWatered ? "Watered Today" : busyAction === "water" ? "Watering..." : "Water Tree"}
              </button>
              <div className="cta-meta">
                <span>{alreadyWatered ? "Come back tomorrow" : "Free daily onchain check-in"}</span>
                {user?.streakCount ? (
                  <strong>Streak: {user.streakCount} days</strong>
                ) : (
                  <strong>Start your streak now</strong>
                )}
              </div>
            </div>

            {chainWarning ? (
              <div className="notice">Switch to Celo Mainnet in MiniPay to continue.</div>
            ) : null}
            {txHash ? <div className="txhash">Last tx: {txHash}</div> : null}
          </div>

          <div className="hero-right">
            <div className="tree-card">
              <div className={`tree tree-${currentStage}`}>
                <div className="tree-core" />
                <div className="tree-canopy" />
                <div className="tree-glow" />
              </div>
              <div className="tree-stage">
                <span className="stage-label">{currentStage}</span>
                <span className="stage-progress">
                  Next milestone: {milestoneLabels[3] || "Seedling"} / {milestoneLabels[7] || "Sapling"} /{" "}
                  {milestoneLabels[14] || "Tree"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="card streak">
          <h2>Streak Center</h2>
          <div className="streak-grid">
            <div className="streak-stat">
              <span className="label">Current Streak</span>
              <strong>{user?.streakCount || 0} days</strong>
            </div>
            <div className="streak-stat">
              <span className="label">Growth Level</span>
              <strong>{user?.growthLevel || 1}</strong>
            </div>
            <div className="streak-stat">
              <span className="label">Total Actions</span>
              <strong>{user?.totalActions || 0}</strong>
            </div>
            <div className="streak-stat">
              <span className="label">Sunlight Sent</span>
              <strong>{user?.sunlightSent || 0}</strong>
            </div>
          </div>
          <div className="milestones">
            {[3, 7, 14].map((days) => (
              <div key={days} className={`milestone ${user?.streakCount >= days ? "active" : ""}`}>
                <span>{days} days</span>
                <strong>{milestoneLabels[days]}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card reward">
          <h2>Weekly Reward</h2>
          <p>
            Keep a 3-day streak to unlock a micro cUSD reward. Claiming triggers an onchain transaction.
          </p>
          <div className="reward-action">
            <button
              className="btn btn-primary"
              onClick={handleClaim}
              disabled={busyAction || !isEligibleReward || showConnect || chainWarning}
            >
              {busyAction === "claim" ? "Claiming..." : isEligibleReward ? "Claim Reward" : "Not Eligible Yet"}
            </button>
            <span className="reward-hint">Minimum streak: 3 days</span>
          </div>
        </section>

        <section className="card sunlight">
          <h2>Send Sunlight</h2>
          <p>Boost a friend’s tree and increase your own activity score.</p>
          <div className="sunlight-form">
            <input
              type="text"
              placeholder="Friend wallet address"
              value={sunlightTo}
              onChange={(event) => setSunlightTo(event.target.value)}
            />
            <button
              className="btn btn-secondary"
              onClick={handleSunlight}
              disabled={busyAction || showConnect || chainWarning}
            >
              {busyAction === "sunlight" ? "Sending..." : "Send Sunlight"}
            </button>
          </div>
        </section>

        <section className="card leaderboard">
          <h2>Great Forest Leaderboard</h2>
          <div className="leaderboard-list">
            {leaderboard.map((entry) => (
              <div key={entry.rank} className="leaderboard-row">
                <span className="rank">#{entry.rank}</span>
                <span className="name">{entry.name}</span>
                <span className="metric">Streak {entry.streak}</span>
                <span className="metric">Growth {entry.growth}</span>
                <span className="metric">Txs {entry.txs}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong>Proof of Humanity:</strong> Ready for MiniPay’s human checks and community attestations.
        </div>
        <div className="footer-note">Built for daily onchain momentum on Celo Mainnet.</div>
      </footer>
    </div>
  );
}
