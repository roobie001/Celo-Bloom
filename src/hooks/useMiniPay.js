import { useEffect, useState } from "react";

export function useMiniPay() {
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    // Try to detect provider immediately
    const detectProvider = () => {
      const injected = window?.ethereum || window?.celo;
      if (injected) {
        setProvider(injected);
        return true;
      }
      return false;
    };

    // Check immediately
    if (detectProvider()) {
      return;
    }

    // If not found, retry with delays for MiniPay injection
    const retryAttempts = [100, 500, 1000, 2000];
    const timeouts = [];

    retryAttempts.forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!provider) {
          detectProvider();
        }
      }, delay);
      timeouts.push(timeout);
    });

    // Listen for provider injection via window events
    const handleProviderInjection = () => {
      const injected = window?.ethereum || window?.celo;
      if (injected && !provider) {
        setProvider(injected);
      }
    };

    window.addEventListener("ethereum#initialized", handleProviderInjection);
    window.addEventListener("celo#initialized", handleProviderInjection);

    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener(
        "ethereum#initialized",
        handleProviderInjection,
      );
      window.removeEventListener("celo#initialized", handleProviderInjection);
    };
  }, []);

  useEffect(() => {
    if (!provider) return;
    const handleAccounts = (accounts) => {
      const next = accounts?.[0] || "";
      setAddress(next);
      setStatus(next ? "connected" : "disconnected");
    };
    const handleChain = (nextChainId) => {
      const parsed =
        typeof nextChainId === "string"
          ? parseInt(nextChainId, 16)
          : Number(nextChainId);
      setChainId(parsed);
    };

    provider
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => {});
    provider
      .request({ method: "eth_chainId" })
      .then(handleChain)
      .catch(() => {});

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [provider]);

  const refreshChain = async () => {
    if (!provider) return;
    try {
      const nextChainId = await provider.request({ method: "eth_chainId" });
      const parsed =
        typeof nextChainId === "string"
          ? parseInt(nextChainId, 16)
          : Number(nextChainId);
      setChainId(parsed);
    } catch (error) {
      console.error(error);
    }
  };

  const switchChain = async ({ chainId, chainName, rpcUrl, explorerUrl }) => {
    if (!provider) return;
    const hexChainId = `0x${Number(chainId).toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
      await refreshChain();
    } catch (error) {
      if (error?.code === 4902 && chainName && rpcUrl) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChainId,
                chainName,
                rpcUrls: [rpcUrl],
                nativeCurrency: {
                  name: "CELO",
                  symbol: "CELO",
                  decimals: 18,
                },
                blockExplorerUrls: explorerUrl ? [explorerUrl] : undefined,
              },
            ],
          });
          await refreshChain();
        } catch (addError) {
          console.error(addError);
        }
      } else {
        console.error(error);
      }
    }
  };

  const connect = async () => {
    if (!provider) return;
    setStatus("connecting");
    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts?.[0] || "");
      setStatus(accounts?.[0] ? "connected" : "disconnected");
      await refreshChain();
    } catch (error) {
      console.error(error);
      setStatus("disconnected");
    }
  };

  const disconnect = async () => {
    try {
      // Attempt to revoke permissions if supported
      if (provider?.request) {
        await provider
          .request({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }],
          })
          .catch(() => {
            // Some wallets don't support this method, which is fine
          });
      }
    } catch (error) {
      console.error("Error revoking permissions:", error);
    } finally {
      // Clear local state
      setAddress("");
      setStatus("disconnected");
    }
  };

  return {
    provider,
    address,
    chainId,
    status,
    connect,
    disconnect,
    refreshChain,
    switchChain,
  };
}
