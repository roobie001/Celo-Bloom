import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { JsonRpcProvider } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  isAddress,
} from "viem";
import { CELO_BLOOM_ABI } from "./abi/celoBloomAbi";
import {
  MILESTONE_LABELS,
  REWARD_MIN_STREAK,
  STREAK_MILESTONES,
} from "./config/gameConfig";
import { useMiniPay } from "./hooks/useMiniPay";
import { shortAddress } from "./utils/format";

const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID);
const RPC_URL = import.meta.env.VITE_CELO_RPC_URL;

const NETWORKS = {
  42220: { name: "Celo Mainnet", explorer: "https://celoscan.io" },
  44787: { name: "Celo Alfajores", explorer: "https://alfajores.celoscan.io" },
  44844: { name: "Celo Sepolia", explorer: "https://sepolia.celoscan.io" },
  11142220: { name: "Celo Sepolia", explorer: "https://sepolia.celoscan.io" },
};

const contractAddress = import.meta.env.VITE_BLOOM_ADDRESS?.trim() || "";
const configError = isAddress(contractAddress)
  ? ""
  : "Missing or invalid VITE_BLOOM_ADDRESS. Add a deployed contract address to your .env and restart the dev server.";

const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: "Celo Custom",
    network: "celo",
    nativeCurrency: {
      name: "CELO",
      symbol: "CELO",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [RPC_URL],
      },
    },
  },
  transport: http(RPC_URL),
});

const networkConfig = NETWORKS[CHAIN_ID] || {
  name: `Chain ${CHAIN_ID}`,
  explorer: "https://celoscan.io",
};
const activeChain = {
  id: CHAIN_ID,
  name: networkConfig.name,
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: networkConfig.explorer },
  },
};

const LEADERBOARD_PAGE_SIZE = 20;
const LEADERBOARD_VISIBLE_COUNT = 5;
const ENS_RPC_URL = "https://cloudflare-eth.com";
const ensProvider = new JsonRpcProvider(ENS_RPC_URL);

function safeNumber(value) {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDayId(tsSeconds) {
  return Math.floor(tsSeconds / 86400);
}

function getWeekId(tsSeconds) {
  return Math.floor(tsSeconds / 604800);
}

function formatTimestamp(tsSeconds) {
  if (!tsSeconds) return "--";
  const date = new Date(tsSeconds * 1000);
  return date.toLocaleString();
}

function truncateWalletAddress(value) {
  if (!value || value.length < 10) return value || "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTimeAgo(timestampMs, nowMs) {
  const diffMs = Math.max(0, nowMs - timestampMs);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 min ago";
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

function getTreeStageByStreak(streakDays) {
  if (streakDays >= 14) return "tree";
  if (streakDays >= 7) return "sapling";
  if (streakDays >= 3) return "seedling";
  return "seed";
}

function renderTreeStageSvg(stage) {
  const trunk = "#7b4f2b";
  const branch = "#8d5c34";

  if (stage === "tree") {
    return (
      <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
        <circle cx="60" cy="40" r="28" fill="#2d8c4d" />
        <circle cx="38" cy="58" r="24" fill="#349a54" />
        <circle cx="82" cy="58" r="24" fill="#2f7f48" />
        <rect x="50" y="84" width="20" height="48" rx="8" fill={trunk} />
        <line x1="50" y1="96" x2="32" y2="88" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="108" x2="28" y2="104" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="120" x2="34" y2="122" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="70" y1="96" x2="88" y2="88" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="70" y1="108" x2="92" y2="104" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="70" y1="120" x2="86" y2="122" stroke={branch} strokeWidth="5" strokeLinecap="round" />
        <line x1="56" y1="132" x2="48" y2="142" stroke="#5f3d20" strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1="132" x2="60" y2="145" stroke="#5f3d20" strokeWidth="4" strokeLinecap="round" />
        <line x1="64" y1="132" x2="72" y2="142" stroke="#5f3d20" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (stage === "sapling") {
    return (
      <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
        <circle cx="60" cy="46" r="24" fill="#47b866" />
        <circle cx="60" cy="68" r="20" fill="#2f9750" />
        <rect x="52" y="88" width="16" height="38" rx="7" fill={trunk} />
        <line x1="52" y1="98" x2="38" y2="90" stroke={branch} strokeWidth="4" strokeLinecap="round" />
        <line x1="52" y1="110" x2="40" y2="110" stroke={branch} strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="98" x2="82" y2="90" stroke={branch} strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="110" x2="80" y2="110" stroke={branch} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (stage === "seedling") {
    return (
      <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
        <ellipse cx="60" cy="52" rx="18" ry="28" fill="#63c67a" />
        <rect x="54" y="82" width="12" height="32" rx="6" fill={trunk} />
        <line x1="54" y1="94" x2="44" y2="88" stroke={branch} strokeWidth="4" strokeLinecap="round" />
        <line x1="66" y1="94" x2="76" y2="88" stroke={branch} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
      <ellipse cx="60" cy="72" rx="20" ry="14" fill="#6f9f72" />
      <rect x="55" y="86" width="10" height="18" rx="5" fill={trunk} />
    </svg>
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isResourceUnavailableError(error) {
  let current = error;
  while (current) {
    if (
      current.name === "ResourceUnavailableRpcError" ||
      current.name === "HttpRequestError" ||
      current.code === -32002
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function calculateLeaderboardScore(userData) {
  return (
    safeNumber(userData?.growthLevel) * 10 +
    safeNumber(userData?.totalActions) +
    safeNumber(userData?.streakCount)
  );
}

function mapContractUser(data) {
  return {
    streakCount: safeNumber(data?.streakCount ?? data?.[0]),
    lastWateredAt: safeNumber(data?.lastWateredAt ?? data?.[1]),
    growthLevel: safeNumber(data?.growthLevel ?? data?.[2]),
    totalActions: safeNumber(data?.totalActions ?? data?.[3]),
    sunlightSent: safeNumber(data?.sunlightSent ?? data?.[4]),
    sunlightReceived: safeNumber(data?.sunlightReceived ?? data?.[5]),
    lastClaimedWeek: safeNumber(data?.lastClaimedWeek ?? data?.[6]),
  };
}

function buildLeaderboardEntry(userAddress, userData) {
  return {
    rank: 0,
    address: userAddress,
    name: shortAddress(userAddress),
    streak: safeNumber(userData?.streakCount),
    growth: safeNumber(userData?.growthLevel),
    txs: safeNumber(userData?.totalActions),
    score: calculateLeaderboardScore(userData),
  };
}

export default function App() {
  const {
    provider,
    address,
    chainId,
    status,
    connect,
    disconnect,
    refreshChain,
    switchChain,
  } = useMiniPay();
  const [user, setUser] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [txHash, setTxHash] = useState("");
  const [sunlightTo, setSunlightTo] = useState("");
  const [sunlightError, setSunlightError] = useState("");
  const [sunlightSuccess, setSunlightSuccess] = useState(null);
  const [recentSunlightSent, setRecentSunlightSent] = useState([]);
  const [relativeTimeNow, setRelativeTimeNow] = useState(Date.now());
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardIdentityMap, setLeaderboardIdentityMap] = useState({});
  const [displayedTreeStage, setDisplayedTreeStage] = useState("seed");
  const [treeStageVisible, setTreeStageVisible] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [claimCount, setClaimCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const stored = Number(window.localStorage.getItem("cb_claim_count") || 0);
      return Number.isFinite(stored) ? stored : 0;
    } catch {
      return 0;
    }
  });
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("cb_onboarded") === "true";
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState(null);
  const [rpcStatus, setRpcStatus] = useState("ok");
  const [rpcError, setRpcError] = useState("");
  const userCacheRef = useRef({
    address: "",
    timestamp: 0,
    data: null,
  });
  const inFlightRefreshRef = useRef({
    address: "",
    promise: null,
  });

  const readClient = client;

  const walletClient = useMemo(() => {
    if (!provider) return null;
    return createWalletClient({
      chain: activeChain,
      transport: custom(provider),
    });
  }, [provider, activeChain]);

  const applyUserState = (data) => {
    const nextUser = mapContractUser(data);
    console.log("User data from contract:", data, "mapped:", nextUser);

    const parsed = {
      streakCount: nextUser.streakCount,
      lastWateredAt: nextUser.lastWateredAt,
      growthLevel: nextUser.growthLevel,
      totalActions: nextUser.totalActions,
      sunlightSent: nextUser.sunlightSent,
      sunlightReceived: nextUser.sunlightReceived,
      lastClaimedWeek: nextUser.lastClaimedWeek,
    };
    setUser(parsed);
    return parsed;
  };

  const refreshLeaderboard = async () => {
    if (configError) return;

    setLeaderboardLoading(true);
    try {
      const participantCount = Number(
        await readClient.readContract({
          address: contractAddress,
          abi: CELO_BLOOM_ABI,
          functionName: "getParticipantCount",
        }),
      );

      if (!participantCount) {
        setLeaderboard([]);
        return;
      }

      const participantAddresses = [];
      for (
        let offset = 0;
        offset < participantCount;
        offset += LEADERBOARD_PAGE_SIZE
      ) {
        const page = await readClient.readContract({
          address: contractAddress,
          abi: CELO_BLOOM_ABI,
          functionName: "getParticipants",
          args: [offset, LEADERBOARD_PAGE_SIZE],
        });
        participantAddresses.push(...page);
      }

      const uniqueAddresses = [...new Set(participantAddresses)];
      const leaderboardEntries = await Promise.all(
        uniqueAddresses.map(async (participantAddress) => {
          const participantData = await readClient.readContract({
            address: contractAddress,
            abi: CELO_BLOOM_ABI,
            functionName: "users",
            args: [participantAddress],
          });
          return buildLeaderboardEntry(
            participantAddress,
            mapContractUser(participantData),
          );
        }),
      );

      const sorted = leaderboardEntries
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      setLeaderboard(sorted);
    } catch (error) {
      console.error(error);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!address || configError) return;
    const now = Date.now();
    const cached = userCacheRef.current;
    if (
      cached.address === address &&
      cached.data &&
      now - cached.timestamp < 5000
    ) {
      applyUserState(cached.data);
      return cached.data;
    }
    if (
      inFlightRefreshRef.current.address === address &&
      inFlightRefreshRef.current.promise
    ) {
      return inFlightRefreshRef.current.promise;
    }
    const request = (async () => {
      setRpcStatus("ok");
      setRpcError("");
      let data;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          data = await readClient.readContract({
            address: contractAddress,
            abi: CELO_BLOOM_ABI,
            functionName: "users",
            args: [address],
          });
          break;
        } catch (error) {
          if (!isResourceUnavailableError(error) || attempt === 2) {
            throw error;
          }
          await sleep(2000 * 2 ** attempt);
        }
      }
      userCacheRef.current = {
        address,
        timestamp: now,
        data,
      };
      return applyUserState(data);
    })()
      .catch((error) => {
        setRpcStatus("error");
        setRpcError("RPC unavailable. Update VITE_RPC_URL.");
        throw error;
      })
      .finally(() => {
        if (inFlightRefreshRef.current.promise === request) {
          inFlightRefreshRef.current = {
            address: "",
            promise: null,
          };
        }
      });
    inFlightRefreshRef.current = {
      address,
      promise: request,
    };
    return request;
  };

  useEffect(() => {
    if (address) {
      refreshUser().catch(() => {});
    }
  }, [address, readClient]);

  useEffect(() => {
    if (configError) {
      setLeaderboard([]);
      return;
    }

    refreshLeaderboard().catch(() => {});
  }, [configError, readClient]);

  useEffect(() => {
    if (!leaderboard.length) {
      setLeaderboardIdentityMap({});
      return;
    }

    let cancelled = false;
    const addressesToResolve = leaderboard
      .map((entry) => entry.address)
      .filter(Boolean);

    setLeaderboardIdentityMap((current) => {
      const next = { ...current };
      for (const entryAddress of addressesToResolve) {
        if (!next[entryAddress]) {
          next[entryAddress] = { status: "loading", value: "" };
        }
      }
      return next;
    });

    Promise.all(
      addressesToResolve.map(async (entryAddress) => {
        try {
          const ensName = await ensProvider.lookupAddress(entryAddress);
          return [
            entryAddress,
            {
              status: "resolved",
              value: ensName || "",
            },
          ];
        } catch (error) {
          console.error(error);
          return [
            entryAddress,
            {
              status: "resolved",
              value: "",
            },
          ];
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setLeaderboardIdentityMap((current) => {
        const next = { ...current };
        for (const [entryAddress, result] of results) {
          next[entryAddress] = result;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [leaderboard]);

  useEffect(() => {
    if (!address || rpcStatus === "error") return;
    const interval = setInterval(() => {
      refreshUser().catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [address, rpcStatus, readClient]);

  const todayId = getDayId(Math.floor(Date.now() / 1000));
  const lastWateredId = user?.lastWateredAt
    ? getDayId(user.lastWateredAt)
    : null;
  const alreadyWatered = lastWateredId === todayId;
  const isEligibleReward =
    user?.streakCount >= REWARD_MIN_STREAK &&
    (user?.lastClaimedWeek || 0) < getWeekId(Math.floor(Date.now() / 1000));
  const streakCount = user?.streakCount || 0;
  const milestoneTreeStage = getTreeStageByStreak(streakCount);

  let nextMilestoneLabel = "first reward";
  let daysToNextMilestone = Math.max(0, 3 - streakCount);
  let progressStart = 0;
  let progressEnd = 3;

  if (streakCount >= 7) {
    nextMilestoneLabel = "Tree";
    daysToNextMilestone = Math.max(0, 14 - streakCount);
    progressStart = 7;
    progressEnd = 14;
  } else if (streakCount >= 3) {
    nextMilestoneLabel = "Sapling";
    daysToNextMilestone = Math.max(0, 7 - streakCount);
    progressStart = 3;
    progressEnd = 7;
  }

  const streakProgress = Math.min(
    100,
    Math.max(
      0,
      ((Math.min(streakCount, progressEnd) - progressStart) /
        (progressEnd - progressStart)) *
        100,
    ),
  );
  const activeMilestoneStage =
    streakCount >= 14 ? 14 : streakCount >= 7 ? 7 : streakCount >= 3 ? 3 : 0;
  const rewardProgress = Math.min(100, Math.max(0, (Math.min(streakCount, 3) / 3) * 100));
  const hasClaimedCurrentReward =
    streakCount >= REWARD_MIN_STREAK && !isEligibleReward;
  const rewardContext = hasClaimedCurrentReward
    ? "Come back tomorrow for your next reward."
    : isEligibleReward
      ? "You've earned it. Claim your cUSD reward below."
      : "Keep your streak going - reward unlocks at day 3.";
  const totalEarnedLabel = (claimCount * 0.01).toFixed(2);

  const ensureWalletReady = () => {
    if (!walletClient || !address || configError) return false;
    return chainId === CHAIN_ID;
  };

  const handleWater = async () => {
    if (!ensureWalletReady()) return;
    setBusyAction("water");
    setTxHash("");
    setToast({
      status: "submitted",
      message: "Transaction submitted...",
      hash: "",
    });
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "waterTree",
        account: address,
      });
      setTxHash(hash);
      setToast({
        status: "confirming",
        message: "Confirming on-chain...",
        hash,
      });
      await readClient.waitForTransactionReceipt({ hash });
      userCacheRef.current = { address: "", timestamp: 0, data: null };
      inFlightRefreshRef.current = { address: "", promise: null };
      await refreshUser().catch(() => {});
      await refreshLeaderboard().catch(() => {});
      setToast({
        status: "success",
        message: "Success - Plant watered",
        hash,
      });
    } catch (error) {
      console.error(error);
      setToast({
        status: "error",
        message: "Transaction failed. Try again.",
        hash: "",
      });
    } finally {
      setBusyAction("");
    }
  };

  const handleSunlight = async () => {
    if (!ensureWalletReady()) return;
    const trimmedSunlightTo = sunlightTo.trim();
    if (!trimmedSunlightTo) return;
    if (!isAddress(trimmedSunlightTo)) {
      setSunlightError("Invalid address");
      setSunlightSuccess(null);
      return;
    }

    setSunlightError("");
    setBusyAction("sunlight");
    setTxHash("");
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "sendSunlight",
        args: [trimmedSunlightTo],
        account: address,
      });
      setTxHash(hash);
      await readClient.waitForTransactionReceipt({ hash });
      userCacheRef.current = { address: "", timestamp: 0, data: null };
      inFlightRefreshRef.current = { address: "", promise: null };
      await refreshUser().catch(() => {});
      await refreshLeaderboard().catch(() => {});
      setSunlightSuccess({ address: trimmedSunlightTo });
      setRecentSunlightSent((current) =>
        [
          {
            address: trimmedSunlightTo,
            sentAt: Date.now(),
          },
          ...current,
        ].slice(0, 3),
      );
    } catch (error) {
      console.error(error);
      setSunlightSuccess(null);
    } finally {
      setBusyAction("");
    }
  };

  const handleClaim = async () => {
    if (!ensureWalletReady()) return;
    setBusyAction("claim");
    setTxHash("");
    setClaimSuccess(false);
    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CELO_BLOOM_ABI,
        functionName: "claimReward",
        account: address,
      });
      setTxHash(hash);
      await readClient.waitForTransactionReceipt({ hash });
      userCacheRef.current = { address: "", timestamp: 0, data: null };
      inFlightRefreshRef.current = { address: "", promise: null };
      await refreshUser().catch(() => {});
      await refreshLeaderboard().catch(() => {});
      const nextClaimCount = claimCount + 1;
      setClaimCount(nextClaimCount);
      setClaimSuccess(true);
      try {
        window.localStorage.setItem("cb_claim_count", String(nextClaimCount));
      } catch {}
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction("");
    }
  };

  const showConnect = status !== "connected";
  const chainWarning = address && chainId !== CHAIN_ID;
  const networkLabel = networkConfig.name;
  const currentNetworkLabel =
    NETWORKS[chainId]?.name || (chainId ? `Chain ${chainId}` : "Unknown");
  const explorerBase =
    import.meta.env.VITE_TX_EXPLORER || `${networkConfig.explorer}/tx`;
  const showOnboardingOverlay =
    !!address &&
    status === "connected" &&
    !!user &&
    user.totalActions === 0 &&
    !onboardingDismissed;
  const visibleLeaderboardEntries = leaderboard.slice(
    0,
    LEADERBOARD_VISIBLE_COUNT,
  );
  const currentUserLeaderboardEntry = address
    ? leaderboard.find(
        (entry) => entry.address?.toLowerCase() === address.toLowerCase(),
      )
    : null;
  const isCurrentUserVisible = currentUserLeaderboardEntry
    ? visibleLeaderboardEntries.some(
        (entry) =>
          entry.address?.toLowerCase() ===
          currentUserLeaderboardEntry.address?.toLowerCase(),
      )
    : false;

  const getLeaderboardIdentity = (entryAddress) => {
    const identity = leaderboardIdentityMap[entryAddress];
    if (!identity || identity.status === "loading") return "...";
    return identity.value || truncateWalletAddress(entryAddress);
  };

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    setOnboardingStep(0);
    try {
      window.localStorage.setItem("cb_onboarded", "true");
    } catch {}
  };

  useEffect(() => {
    if (!toast || toast.status !== "success") return;
    const timeout = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!sunlightSuccess) return;
    const timeout = setTimeout(() => {
      setSunlightSuccess(null);
      setSunlightTo("");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [sunlightSuccess]);

  useEffect(() => {
    if (!recentSunlightSent.length) return;
    const interval = setInterval(() => {
      setRelativeTimeNow(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [recentSunlightSent.length]);

  useEffect(() => {
    if (!claimSuccess) return;
    const timeout = setTimeout(() => {
      setClaimSuccess(false);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [claimSuccess]);

  useEffect(() => {
    if (displayedTreeStage === milestoneTreeStage) return;

    setTreeStageVisible(false);
    const timeout = setTimeout(() => {
      setDisplayedTreeStage(milestoneTreeStage);
      setTreeStageVisible(true);
    }, 180);

    return () => clearTimeout(timeout);
  }, [displayedTreeStage, milestoneTreeStage]);

  useEffect(() => {
    if (onboardingDismissed || !user || user.totalActions !== 0 || !address) {
      setOnboardingStep(0);
    }
  }, [address, onboardingDismissed, user]);

  const onboardingSteps = [
    {
      headline: "Water your tree daily.",
      body: "One onchain action per day keeps your streak alive. Miss a day and it resets to zero.",
      visual: (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "170px",
          }}
        >
          {renderTreeStageSvg("seed")}
        </div>
      ),
    },
    {
      headline: "Watch it grow.",
      body: "Day 3 -> Seedling. Day 7 -> Sapling. Day 14 -> Tree. Each stage is a real onchain milestone.",
      visual: (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flexWrap: "wrap",
            minHeight: "170px",
          }}
        >
          {["Seed", "Seedling", "Sapling", "Tree"].map((label, index) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "999px",
                  background: "rgba(140, 255, 205, 0.12)",
                  border: "1px solid rgba(140, 255, 205, 0.2)",
                  color: "var(--text)",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
              {index < 3 ? (
                <span style={{ color: "var(--accent)", fontSize: "14px" }}>
                  -&gt;
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ),
    },
    {
      headline: "Earn as you grow.",
      body: "Hit a 3-day streak and claim a micro cUSD reward. Small but real - every claim is an onchain transaction.",
      visual: (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "170px",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              background: "rgba(124, 255, 194, 0.12)",
              border: "1px solid rgba(124, 255, 194, 0.3)",
              color: "var(--accent)",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            0.01 cUSD
          </div>
        </div>
      ),
    },
  ];
  const currentOnboardingStep = onboardingSteps[onboardingStep];
  const isLastOnboardingStep = onboardingStep === onboardingSteps.length - 1;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Celo Bloom</span>
          <span className="brand-tag">Proof of Ship Mini App</span>
        </div>
        <div className="wallet">
          {showConnect ? (
            <button
              className="btn btn-primary"
              onClick={connect}
              disabled={!provider}
              title={
                !provider
                  ? "MiniPay wallet not detected"
                  : "Click to connect your wallet"
              }
            >
              {!provider ? "MiniPay Not Found" : "Connect MiniPay"}
            </button>
          ) : (
            <div className="wallet-pill">
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span>{shortAddress(address)}</span>
                <span className="wallet-status">{currentNetworkLabel}</span>
              </div>
              <button
                className="btn btn-secondary"
                onClick={disconnect}
                title="Disconnect wallet"
                style={{ padding: "4px 12px", fontSize: "12px" }}
              >
                Disconnect
              </button>
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
              Watering keeps your streak alive. Sunlight makes friends grow
              faster. Rewards are tiny but frequent.
            </p>

            <div className="cta-row">
              <button
                className="btn btn-accent"
                onClick={handleWater}
                disabled={
                  busyAction ||
                  alreadyWatered ||
                  showConnect ||
                  chainWarning ||
                  !!configError
                }
              >
                {alreadyWatered
                  ? "Watered Today"
                  : busyAction === "water"
                    ? "Watering..."
                    : "Water Tree"}
              </button>
              <div className="cta-meta">
                <span>
                  {alreadyWatered
                    ? "Come back tomorrow"
                    : "Free daily onchain check-in"}
                </span>
                {user?.streakCount ? (
                  <strong>Streak: {user.streakCount} days</strong>
                ) : (
                  <strong>Start your streak now</strong>
                )}
              </div>
            </div>

            {chainWarning ? (
              <div className="notice">
                Switch to {networkLabel} in MiniPay to continue.
              </div>
            ) : null}
            {configError ? <div className="notice">{configError}</div> : null}
            {rpcStatus === "error" ? (
              <div className="notice">
                {rpcError} Use a working RPC URL and restart the dev server.
              </div>
            ) : null}
            <div className="chain-actions">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  switchChain({
                    chainId: CHAIN_ID,
                    chainName: networkLabel,
                    rpcUrl: RPC_URL,
                    explorerUrl: explorerBase.replace("/tx", ""),
                  })
                }
                disabled={!provider}
              >
                Switch Network
              </button>
              <button
                className="btn btn-secondary"
                onClick={refreshChain}
                disabled={!provider}
              >
                Refresh Network
              </button>
              <button
                className="btn btn-secondary"
                onClick={refreshUser}
                disabled={!provider || !address || !!configError}
              >
                Retry RPC
              </button>
            </div>
            {address ? (
              <div className="chain-meta">
                Connected chain: {currentNetworkLabel}{" "}
                {chainId ? `(${chainId})` : ""}
              </div>
            ) : null}
            {txHash ? <div className="txhash">Last tx: {txHash}</div> : null}
          </div>

          <div className="hero-right">
            <div className="tree-card">
              <div
                className="tree"
                style={{
                  opacity: treeStageVisible ? 1 : 0,
                  transition: "opacity 0.6s ease",
                }}
              >
                {renderTreeStageSvg(displayedTreeStage)}
              </div>
              <div className="tree-stage">
                <span className="stage-label">
                  {displayedTreeStage.toUpperCase()}
                </span>
                <span className="stage-progress">
                  Next milestone: {MILESTONE_LABELS[3] || "Seedling"} /{" "}
                  {MILESTONE_LABELS[7] || "Sapling"} /{" "}
                  {MILESTONE_LABELS[14] || "Tree"}
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
              <strong>{streakCount} days</strong>
              <span className="label" style={{ letterSpacing: "0.08em" }}>
                {daysToNextMilestone} days to {nextMilestoneLabel}
              </span>
              <div
                aria-hidden="true"
                style={{
                  height: "8px",
                  borderRadius: "999px",
                  background: "rgba(140, 255, 205, 0.12)",
                  overflow: "hidden",
                  marginTop: "4px",
                }}
              >
                <div
                  style={{
                    width: `${streakProgress}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: "linear-gradient(120deg, #ffd976, #ffb54a)",
                    boxShadow: "0 0 14px rgba(255, 196, 82, 0.28)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              {user && !alreadyWatered ? (
                <div className="notice">⚠ Water today or lose your streak</div>
              ) : null}
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
          <div className="streak-meta">
            <div>
              <span className="label">Last Watered</span>
              <strong>{formatTimestamp(user?.lastWateredAt)}</strong>
            </div>
            <button
              className="btn btn-secondary"
              onClick={refreshUser}
              disabled={busyAction}
            >
              Refresh Stats
            </button>
          </div>
          <div className="milestones">
            {STREAK_MILESTONES.map((days) => (
              <div
                key={days}
                className={`milestone ${activeMilestoneStage === days ? "active" : ""}`}
                style={
                  activeMilestoneStage === days
                    ? {
                        boxShadow: "0 0 0 1px rgba(124, 255, 194, 0.18)",
                        transform: "translateY(-1px)",
                      }
                    : undefined
                }
              >
                <span>{days} days</span>
                <strong>{MILESTONE_LABELS[days]}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card reward">
          <h2>Weekly Reward</h2>
          <p>{rewardContext}</p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(4, 18, 16, 0.7)",
              border: "1px solid rgba(140, 255, 205, 0.18)",
            }}
          >
            <strong style={{ fontSize: "24px", lineHeight: 1.1 }}>
              0.01 cUSD
            </strong>
            <span style={{ color: "var(--muted)", fontSize: "12px" }}>
              &asymp; real money on Celo mainnet
            </span>
            <span style={{ color: "var(--accent)", fontSize: "12px" }}>
              Total earned: {totalEarnedLabel} cUSD
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "rgba(140, 255, 205, 0.12)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${rewardProgress}%`,
                height: "100%",
                borderRadius: "999px",
                background: "linear-gradient(120deg, #7cffc2, #2aa06d)",
                boxShadow: "0 0 14px rgba(56, 203, 138, 0.28)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span className="reward-hint">
            Reward progress: {Math.min(streakCount, 3)} / 3 days
          </span>
          <div className="reward-action">
            <button
              className="btn btn-primary"
              onClick={handleClaim}
              disabled={
                busyAction ||
                !isEligibleReward ||
                showConnect ||
                chainWarning ||
                !!configError
              }
            >
              {busyAction === "claim"
                ? "Claiming..."
                : isEligibleReward
                  ? "Claim Reward"
                  : "Not Eligible Yet"}
            </button>
            <span className="reward-hint">
              Minimum streak: {REWARD_MIN_STREAK} days
            </span>
          </div>
          {claimSuccess ? (
            <div style={{ color: "var(--accent)", fontSize: "13px" }}>
              ✓ Claimed! Check your wallet.
            </div>
          ) : null}
        </section>

        <section className="card sunlight">
          <h2>Send Sunlight</h2>
          <p>Boost a friend's tree and increase your own activity score.</p>
          <div className="sunlight-form">
            <input
              type="text"
              placeholder="Friend wallet address"
              value={sunlightTo}
              onChange={(event) => {
                setSunlightTo(event.target.value);
                if (sunlightError) {
                  setSunlightError("");
                }
              }}
            />
            {sunlightError ? (
              <div style={{ color: "#ff7b7b", fontSize: "12px" }}>
                {sunlightError}
              </div>
            ) : null}
            <button
              className="btn btn-secondary"
              onClick={handleSunlight}
              disabled={
                busyAction || showConnect || chainWarning || !!configError
              }
            >
              {busyAction === "sunlight" ? "Sending..." : "Send Sunlight"}
            </button>
          </div>
          {sunlightSuccess ? (
            <div>
              <div style={{ color: "var(--text)", fontSize: "13px" }}>
                ☀ Sunlight sent to{" "}
                {truncateWalletAddress(sunlightSuccess.address)}
              </div>
              <div style={{ color: "var(--accent)", fontSize: "12px" }}>
                Your activity score +1
              </div>
            </div>
          ) : null}
          {recentSunlightSent.length ? (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "var(--muted)",
                  marginBottom: "8px",
                }}
              >
                Recent Sunlight Sent
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {recentSunlightSent.map((entry) => (
                  <div
                    key={`${entry.address}-${entry.sentAt}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      fontSize: "12px",
                      color: "var(--muted)",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "rgba(5, 20, 18, 0.7)",
                      border: "1px solid rgba(124, 255, 194, 0.08)",
                    }}
                  >
                    <span>{truncateWalletAddress(entry.address)}</span>
                    <span>{formatTimeAgo(entry.sentAt, relativeTimeNow)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="card leaderboard">
          <h2>Great Forest Leaderboard</h2>
          <div className="leaderboard-list">
            {leaderboardLoading ? (
              <div className="leaderboard-row">
                <span className="name">Loading leaderboard...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="leaderboard-row">
                <span className="name">
                  No participants yet. Be the first to grow a tree.
                </span>
              </div>
            ) : (
              <>
                {visibleLeaderboardEntries.map((entry) => {
                  const isCurrentUser =
                    address &&
                    entry.address?.toLowerCase() === address.toLowerCase();

                  return (
                    <div
                      key={entry.address || entry.rank}
                      className="leaderboard-row"
                    >
                      <span className="rank">#{entry.rank}</span>
                      <span
                        className="name"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getLeaderboardIdentity(entry.address)}
                        </span>
                        {isCurrentUser ? (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--accent)",
                              border: "1px solid rgba(124, 255, 194, 0.35)",
                              background: "rgba(124, 255, 194, 0.12)",
                              borderRadius: "999px",
                              padding: "2px 8px",
                              flexShrink: 0,
                            }}
                          >
                            You
                          </span>
                        ) : null}
                      </span>
                      <span className="metric">Streak {entry.streak}</span>
                      <span className="metric">Growth {entry.growth}</span>
                      <span className="metric">Txs {entry.txs}</span>
                    </div>
                  );
                })}
                {currentUserLeaderboardEntry && !isCurrentUserVisible ? (
                  <div
                    style={{
                      borderTop: "1px solid rgba(124, 255, 194, 0.15)",
                      marginTop: "6px",
                      paddingTop: "10px",
                    }}
                  >
                    <div className="leaderboard-row">
                      <span className="rank">
                        #{currentUserLeaderboardEntry.rank}
                      </span>
                      <span
                        className="name"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getLeaderboardIdentity(
                            currentUserLeaderboardEntry.address,
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--accent)",
                            border: "1px solid rgba(124, 255, 194, 0.35)",
                            background: "rgba(124, 255, 194, 0.12)",
                            borderRadius: "999px",
                            padding: "2px 8px",
                            flexShrink: 0,
                          }}
                        >
                          You
                        </span>
                      </span>
                      <span className="metric">
                        Streak {currentUserLeaderboardEntry.streak}
                      </span>
                      <span className="metric">
                        Growth {currentUserLeaderboardEntry.growth}
                      </span>
                      <span className="metric">
                        Txs {currentUserLeaderboardEntry.txs}
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>

      {showOnboardingOverlay ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(2, 10, 9, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "540px",
              background: "var(--card)",
              border: "1px solid rgba(196, 255, 228, 0.2)",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 24px 60px rgba(4, 12, 14, 0.45)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span className="eyebrow">
                Step {onboardingStep + 1} of {onboardingSteps.length}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                {onboardingSteps.map((_, index) => (
                  <span
                    key={index}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background:
                        index === onboardingStep
                          ? "var(--accent)"
                          : "rgba(140, 255, 205, 0.18)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div>{currentOnboardingStep.visual}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--title-font)",
                  fontSize: "28px",
                }}
              >
                {currentOnboardingStep.headline}
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                {currentOnboardingStep.body}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: "12px" }}>
                Learn the loop, then start your first streak.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (isLastOnboardingStep) {
                    dismissOnboarding();
                    return;
                  }
                  setOnboardingStep((step) => step + 1);
                }}
              >
                {isLastOnboardingStep ? "Start Growing ->" : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast toast-${toast.status}`}>
          <div className="toast-row">
            <span
              className={`toast-icon toast-${toast.status}`}
              aria-hidden="true"
            >
              {toast.status === "confirming"
                ? "..."
                : toast.status === "success"
                  ? "OK"
                  : toast.status === "error"
                    ? "!"
                    : "."}
            </span>
            <div className="toast-message">{toast.message}</div>
          </div>
          {toast.hash ? (
            <a
              className="toast-link"
              href={`${explorerBase}/${toast.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Explorer
            </a>
          ) : null}
        </div>
      ) : null}

      <footer className="footer">
        <div>
          <strong>Proof of Humanity:</strong> Ready for MiniPay's human checks
          and community attestations.
        </div>
        <div className="footer-note">
          Built for daily onchain momentum on {networkLabel}.
        </div>
      </footer>
    </div>
  );
}
