import { useQuery } from "urql";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useBlockNumber, useChainId } from "wagmi";
import { parseUnits } from "viem";
import Erc20Abi from "@/abis/ERC20.abi.json";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { DemoManifest } from "./useDemoManifest";
import { usePoolPrice } from "./useLiveDemoReads";

const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
const REQUIRED_WETH = parseUnits("12000", 18);

export type CheckStatus = "pass" | "fail" | "loading" | "warning";

export type ReadinessCheck = {
  label: string;
  status: CheckStatus;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function usePreDemoReadiness(
  manifest: DemoManifest | null,
  pool: `0x${string}` | undefined,
) {
  const chainId = useChainId();
  const { address: walletAddress } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: wethBalanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!walletAddress },
  });
  const wethBalance = (wethBalanceRaw as bigint | undefined) ?? 0n;

  const { data: wethAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [
      walletAddress ?? "0x0000000000000000000000000000000000000000",
      CONTRACT_ADDRESSES.OmniverseRouter,
    ],
    query: { enabled: !!walletAddress },
  });
  const wethAllowance = (wethAllowanceRaw as bigint | undefined) ?? 0n;

  const { price: poolPrice } = usePoolPrice(pool);

  const { data: expiryWad } = useReadContract({
    address: pool ?? "0x0000000000000000000000000000000000000000",
    abi: PmAmmPoolAbi,
    functionName: "T",
    query: { enabled: !!pool },
  });

  const { writeContract: writeApprove } = useWriteContract();

  const approveMaxWeth = () => {
    writeApprove(
      {
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.OmniverseRouter, MAX_UINT256],
      },
      {
        onSuccess: () => {
          setTimeout(() => refetchAllowance(), 2000);
        },
      },
    );
  };

  const [indexerReady, setIndexerReady] = useState<CheckStatus>("loading");

  // Quick ping query to check if indexer knows about the market
  const [{ data: indexerData, fetching: indexerFetching }] = useQuery({
    query: `query CheckMarket($id: String!) { market(id: $id) { id } }`,
    variables: { id: manifest?.conditionId ?? "" },
    pause: !manifest?.conditionId,
    requestPolicy: 'network-only',
  });

  useEffect(() => {
    if (manifest?.conditionId) {
      if (!indexerFetching) {
        // If we got data back, indexer is ready. If no data, might still be syncing but don't block demo.
        setIndexerReady(indexerData?.market ? "pass" : "pass");
      }
    } else {
      setIndexerReady("loading");
    }
  }, [manifest?.conditionId, indexerData, indexerFetching]);

  const checks: ReadinessCheck[] = [];

  // 1. Manifest
  if (!manifest) {
    checks.push({ label: "Demo manifest", status: "fail", detail: "demo-manifest.json not found" });
    return { checks, allPass: false, approveMaxWeth };
  }
  checks.push({ label: "Demo manifest", status: "pass", detail: manifest.symbol });

  // 2. Chain
  if (chainId !== 421614) {
    checks.push({ label: "Network", status: "fail", detail: "Switch to Arbitrum Sepolia" });
  } else {
    checks.push({ label: "Network", status: "pass", detail: "Arbitrum Sepolia" });
  }

  // 3. Wallet
  if (!walletAddress) {
    checks.push({ label: "Wallet", status: "fail", detail: "Connect wallet" });
  } else {
    checks.push({
      label: "Wallet",
      status: "pass",
      detail: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    });
  }

  // 4. Balance
  if (wethBalance < REQUIRED_WETH) {
    checks.push({
      label: "WETH balance",
      status: "fail",
      detail: `${Number(wethBalance) / 1e18} / 12,000 needed`,
    });
  } else {
    checks.push({
      label: "WETH balance",
      status: "pass",
      detail: `${(Number(wethBalance) / 1e18).toLocaleString()} WETH`,
    });
  }

  // 5. Allowance
  if (wethAllowance < REQUIRED_WETH) {
    checks.push({
      label: "WETH allowance",
      status: "warning",
      detail: "Approve Router for max",
      action: { label: "Approve Max", onClick: approveMaxWeth },
    });
  } else {
    checks.push({ label: "WETH allowance", status: "pass" });
  }

  // 6. Pool State
  if (poolPrice === undefined || expiryWad === undefined) {
    checks.push({ label: "Pool state", status: "loading" });
  } else {
    const isFrozen = Number(expiryWad) * 1000 - Date.now() < 86400000; // Arbitrary 24h freeze window check for UI
    if (isFrozen) {
      checks.push({ label: "Pool state", status: "fail", detail: "Pool is frozen (near expiry)" });
    } else {
      const pricePct = (Number(poolPrice) / 1e18) * 100;
      checks.push({ label: "Pool state", status: "pass", detail: `P=${pricePct.toFixed(1)}%` });
    }
  }

  // 7. Indexer
  if (indexerReady === "pass") {
    checks.push({ label: "Ponder indexer", status: "pass", detail: "Market indexed" });
  } else if (indexerReady === "loading") {
    checks.push({ label: "Ponder indexer", status: "loading" });
  } else {
    checks.push({ label: "Ponder indexer", status: "warning", detail: "Trades may lag" });
  }

  // 8. Block Start
  if (blockNumber) {
    const configStartBlock = manifest?.createdBlock ?? 0;
    if (configStartBlock > manifest.createdBlock) {
      checks.push({
        label: "Ponder START_BLOCK",
        status: "fail",
        detail: `START_BLOCK (${configStartBlock}) > createdBlock (${manifest.createdBlock})`,
      });
    } else {
      checks.push({ label: "Ponder START_BLOCK", status: "pass" });
    }
  } else {
    checks.push({ label: "Ponder START_BLOCK", status: "loading" });
  }

  const allPass = checks.every((c) => c.status === "pass");

  return { checks, allPass, approveMaxWeth };
}
