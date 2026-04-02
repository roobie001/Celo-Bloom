import { useEffect, useState } from "react";

export function useMiniPay() {
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    const injected = window?.ethereum || window?.celo;
    if (injected) {
      setProvider(injected);
    }
  }, []);

  useEffect(() => {
    if (!provider) return;
    const handleAccounts = (accounts) => {
      const next = accounts?.[0] || "";
      setAddress(next);
      setStatus(next ? "connected" : "disconnected");
    };
    const handleChain = (nextChainId) => {
      const parsed = typeof nextChainId === "string" ? parseInt(nextChainId, 16) : Number(nextChainId);
      setChainId(parsed);
    };

    provider.request({ method: "eth_accounts" }).then(handleAccounts).catch(() => {});
    provider.request({ method: "eth_chainId" }).then(handleChain).catch(() => {});

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [provider]);

  const connect = async () => {
    if (!provider) return;
    setStatus("connecting");
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      setAddress(accounts?.[0] || "");
      setStatus(accounts?.[0] ? "connected" : "disconnected");
    } catch (error) {
      console.error(error);
      setStatus("disconnected");
    }
  };

  return {
    provider,
    address,
    chainId,
    status,
    connect,
  };
}
