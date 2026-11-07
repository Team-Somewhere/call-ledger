"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import {
  api,
  ApiRequestError,
} from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";
import type {
  FlashQuoteResponse,
  FlashOrderStatusResponse,
} from "@call-ledger/definitive";
import {
  VERIFIED_ASSETS,
  VERIFIED_CHAINS,
  type Order,
  type StrategyHandoffDraft,
  type VerifiedAsset,
} from "@call-ledger/shared";

type FlashOrderChoice =
  | "market"
  | "limit"
  | "twap"
  | "stop"
  | "stop-loss"
  | "take-profit"
  | "bracket";

interface TradeFormState {
  chain: string;
  targetSymbol: string;
  contraSymbol: string;
  side: "buy" | "sell";
  orderType: FlashOrderChoice;
  limitPrice: string;
  stopPrice: string;
  takeProfitPrice: string;
  twapMinutes: string;
  attachProtection: boolean;
  qty: string;
  maxSlippage: string;
  expiryHours: string;
}

function buildTriggers(form: TradeFormState) {
  if (form.orderType === "stop") {
    return form.stopPrice
      ? [{ notionalPrice: form.stopPrice, triggerType: "upper" as const }]
      : undefined;
  }
  if (form.orderType === "stop-loss") {
    return form.stopPrice
      ? [{ notionalPrice: form.stopPrice, triggerType: "lower" as const }]
      : undefined;
  }
  if (form.orderType === "take-profit") {
    return form.takeProfitPrice
      ? [{ notionalPrice: form.takeProfitPrice, triggerType: "upper" as const }]
      : undefined;
  }
  if (form.orderType === "bracket") {
    if (!form.stopPrice || !form.takeProfitPrice) return undefined;
    return [
      { notionalPrice: form.takeProfitPrice, triggerType: "upper" as const },
      { notionalPrice: form.stopPrice, triggerType: "lower" as const },
    ];
  }
  return undefined;
}

function TradeContent() {
  const searchParams = useSearchParams();
  const wallet = useWalletSession();

  // Initial handoff parsed from extension URL query string
  const handoffDraft = useMemo<StrategyHandoffDraft | null>(() => {
    const raw = searchParams.get("draft");
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as StrategyHandoffDraft;
    } catch {
      return null;
    }
  }, [searchParams]);

  // Server configuration state
  const [config, setConfig] = useState<{
    configured: boolean;
    supportedChains: Record<string, { name: string; chainId: number; explorerBaseUrl: string }>;
    verifiedAssets: typeof VERIFIED_ASSETS;
  } | null>(null);

  // Form state
  const [form, setForm] = useState<TradeFormState>({
    chain: handoffDraft?.chain || "base",
    targetSymbol: handoffDraft?.targetSymbol || "WETH",
    contraSymbol: handoffDraft?.contraSymbol || "USDC",
    side: handoffDraft?.direction || "buy",
    orderType: (handoffDraft?.orderType as FlashOrderChoice) || "limit",
    limitPrice: handoffDraft?.limitPrice ? String(handoffDraft.limitPrice) : "",
    stopPrice: handoffDraft?.stopLoss ? String(handoffDraft.stopLoss) : "",
    takeProfitPrice: handoffDraft?.takeProfit ? String(handoffDraft.takeProfit) : "",
    twapMinutes: "30",
    attachProtection: Boolean(handoffDraft?.stopLoss && handoffDraft?.takeProfit),
    qty: "",
    maxSlippage: "0.01",
    expiryHours: "24",
  });

  // Flow lifecycle state
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quote, setQuote] = useState<FlashQuoteResponse | null>(null);

  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  const [isApproving, setIsApproving] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  const [isWrapping, setIsWrapping] = useState(false);
  const [wrapTxHash, setWrapTxHash] = useState<string | null>(null);
  const [isWrapped, setIsWrapped] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [flashStatus, setFlashStatus] = useState<FlashOrderStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Load API configuration on mount
  useEffect(() => {
    let active = true;
    api
      .getOrderConfig()
      .then((res) => {
        if (active) setConfig(res.data);
      })
      .catch((err) => {
        console.warn("Could not load Definitive config:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Selected asset metadata
  const selectedTargetAsset = useMemo<VerifiedAsset | null>(() => {
    const chainAssets = VERIFIED_ASSETS[form.chain] || {};
    return chainAssets[form.targetSymbol] || chainAssets.WETH || null;
  }, [form.chain, form.targetSymbol]);

  const selectedContraAsset = useMemo<VerifiedAsset | null>(() => {
    const chainAssets = VERIFIED_ASSETS[form.chain] || {};
    return chainAssets[form.contraSymbol] || chainAssets.USDC || null;
  }, [form.chain, form.contraSymbol]);

  const chainMeta = VERIFIED_CHAINS[form.chain] || VERIFIED_CHAINS.base;

  // Step 1: Request Quote
  const handleRequestQuote = async () => {
    let activeAddress = wallet.address;

    // If wallet is not connected or session is not authenticated, prompt connection seamlessly
    if (!activeAddress || !wallet.isAuthenticated) {
      setIsQuoting(true);
      setQuoteError(null);
      const ok = await wallet.connect();
      if (!ok) {
        setIsQuoting(false);
        setQuoteError("Please connect and sign the login challenge in your wallet to request a live quote.");
        return;
      }
      // Re-read updated address
      activeAddress = wallet.address;
      if (!activeAddress && typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
          if (accounts?.[0]) activeAddress = accounts[0].toLowerCase();
        } catch {
          // ignore
        }
      }
    }

    if (!activeAddress) {
      setQuoteError("Please connect your wallet first.");
      return;
    }
    if (!selectedTargetAsset || !selectedContraAsset) {
      setQuoteError("Selected assets are invalid for this chain.");
      return;
    }
    if (form.side === "buy" && Number(form.qty) > 0 && Number(form.qty) < 0.05) {
      setQuoteError(
        "Amount is too small. Flash rejects buys under about 0.05 USDC because the trading fee is larger than the tokens you would receive.",
      );
      return;
    }
    if ((form.orderType === "limit" || form.orderType === "twap") && !form.limitPrice) {
      setQuoteError("Enter a limit price before requesting this quote.");
      return;
    }

    setIsQuoting(true);
    setQuoteError(null);
    setQuote(null);
    setOrder(null);
    setFlashStatus(null);
    setSigningError(null);
    setSubmitError(null);
    setApprovalTxHash(null);
    setIsApproved(false);
    setWrapTxHash(null);
    setIsWrapped(false);

    try {
      const res = await api.requestQuote({
        targetChain: form.chain,
        contraChain: form.chain,
        targetAsset: selectedTargetAsset.address,
        contraAsset: selectedContraAsset.address,
        side: form.side,
        qty: form.qty,
        orderType: form.orderType,
        limitNotionalPrice:
          form.orderType === "limit" || form.orderType === "twap" || form.orderType === "stop"
            ? form.limitPrice || undefined
            : undefined,
        funderAddress: activeAddress,
        maxSlippage: form.orderType === "market" ? form.maxSlippage : undefined,
        maxPriceImpact: form.orderType === "market" ? undefined : form.maxSlippage,
        signalId: searchParams.get("signalId"),
        expireTime:
          form.orderType !== "market" && form.orderType !== "twap" && form.expiryHours !== "gtc"
            ? new Date(Date.now() + parseInt(form.expiryHours, 10) * 3600 * 1000).toISOString()
            : undefined,
        durationSeconds:
          form.orderType === "twap" ? Math.max(300, Number(form.twapMinutes) * 60) : undefined,
        triggers: buildTriggers(form),
        attachedBracket:
          form.attachProtection &&
          ["market", "limit", "twap"].includes(form.orderType) &&
          form.stopPrice &&
          form.takeProfitPrice
            ? {
                takeProfit: { notionalPrice: form.takeProfitPrice },
                stopLoss: { notionalPrice: form.stopPrice },
              }
            : undefined,
      });

      setQuote(res.data);
      // If quote has no approval requirement, mark approved
      if (!res.data.evm?.approveTx) {
        setIsApproved(true);
      }
      if (!res.data.wrap?.evmTx) {
        setIsWrapped(true);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to request quote";
      setQuoteError(msg);
    } finally {
      setIsQuoting(false);
    }
  };

  // Step 2A: One-Time Token Spending Approval (Required by Definitive Flash)
  const handleApproveToken = async (): Promise<boolean> => {
    if (!quote?.evm?.approveTx) {
      setIsApproved(true);
      return true;
    }
    setIsApproving(true);
    setSigningError(null);
    setSubmitError(null);

    if (chainMeta) {
      await wallet.switchChain(chainMeta.chainId);
    }

    try {
      const tx = quote.evm.approveTx;
      const txHash = await wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value || "0x0",
      });

      setApprovalTxHash(txHash);
      // Wait for Base block confirmation
      await new Promise((resolve) => setTimeout(resolve, 4000));
      setIsApproved(true);
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to approve token allowance";
      setSigningError(msg);
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  // Step 2B: Native Token Wrapping (if native ETH requires WETH)
  const handleWrapToken = async (): Promise<boolean> => {
    if (!quote?.wrap?.evmTx) {
      setIsWrapped(true);
      return true;
    }
    setIsWrapping(true);
    setSigningError(null);
    setSubmitError(null);

    if (chainMeta) {
      await wallet.switchChain(chainMeta.chainId);
    }

    try {
      const tx = quote.wrap.evmTx;
      const txHash = await wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value || "0x0",
      });

      setWrapTxHash(txHash);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      setIsWrapped(true);
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to wrap native token";
      setSigningError(msg);
      return false;
    } finally {
      setIsWrapping(false);
    }
  };

  // Step 3: Sign with Wallet and Submit Order
  const handleSignAndSubmit = async () => {
    if (!quote) return;
    let activeAddress = wallet.address;
    if (!activeAddress) {
      const ok = await wallet.connect();
      if (!ok || !wallet.address) {
        setSigningError("Wallet disconnected. Reconnect to sign.");
        return;
      }
      activeAddress = wallet.address;
    }

    // If wrap is required and not finished, execute wrap first
    if (quote.wrap?.evmTx && !isWrapped) {
      const wrapped = await handleWrapToken();
      if (!wrapped) return;
    }

    // If token approval is required and not finished, execute approve first
    if (quote.evm?.approveTx && !isApproved) {
      const approved = await handleApproveToken();
      if (!approved) return;
    }

    setIsSigning(true);
    setSigningError(null);
    setSubmitError(null);

    // Switch to target chain if needed
    if (chainMeta) {
      await wallet.switchChain(chainMeta.chainId);
    }

    if (quote.validUntil && Date.parse(quote.validUntil) <= Date.now()) {
      setSigningError("This quote has expired. Request a fresh quote and review it again.");
      return;
    }
    if (wallet.address && quote.funderAddress && wallet.address.toLowerCase() !== quote.funderAddress.toLowerCase()) {
      setSigningError("The connected wallet changed. Request a new quote for this wallet.");
      return;
    }

    let signature = "";
    let permitSignature: string | undefined;
    let bracketSignature: string | undefined;
    let bracketMeta: {
      salt?: string;
      deadline?: string;
      signedMaxFromAmount?: string;
    } | undefined;
    try {
      if (quote.evm?.permitTypedData) {
        permitSignature = await wallet.signTypedData(quote.evm.permitTypedData);
      }
      const typedData = quote.evm?.orderTypedDataRaw || quote.evm?.orderTypedData;
      if (!typedData) {
        throw new Error("No signable EIP-712 typed data returned in quote.");
      }
      signature = await wallet.signTypedData(typedData as unknown as Record<string, unknown>);
      const bracketTyped = (quote.attachedBracket as { evm?: { orderTypedData?: string } } | null)?.evm?.orderTypedData;
      if (bracketTyped) {
        bracketSignature = await wallet.signTypedData(bracketTyped);
        bracketMeta = quote.attachedBracket as {
          salt?: string;
          deadline?: string;
          signedMaxFromAmount?: string;
        };
      }
    } catch (err: unknown) {
      setIsSigning(false);
      setSigningError(err instanceof Error ? err.message : "User rejected signature");
      return;
    }

    setIsSigning(false);
    setIsSubmitting(true);

    try {
      const submitRes = await api.submitOrder({
        targetChain: form.chain,
        contraChain: form.chain,
        targetAsset: selectedTargetAsset!.address,
        contraAsset: selectedContraAsset!.address,
        side: form.side,
        qty: form.qty,
        orderType: form.orderType,
        funderAddress: activeAddress,
        quoteId: quote.quoteId,
        userSignature: signature,
        evmOrderTypedData: (quote.evm?.orderTypedDataRaw || quote.evm?.orderTypedData) as
          | string
          | Record<string, unknown>
          | undefined,
        evmPermitTypedData: quote.evm?.permitTypedData || undefined,
        evmPermitSignature: permitSignature,
        signalId: searchParams.get("signalId"),
        attachedBracket:
          bracketSignature && bracketMeta?.deadline && bracketMeta.signedMaxFromAmount
            ? {
                takeProfit: { notionalPrice: form.takeProfitPrice },
                stopLoss: { notionalPrice: form.stopPrice },
                userSignature: bracketSignature,
                salt: bracketMeta.salt,
                deadline: bracketMeta.deadline,
                signedMaxFromAmount: bracketMeta.signedMaxFromAmount,
              }
            : undefined,
      });

      setOrder(submitRes.data.order);
      setFlashStatus({
        orderId: submitRes.data.flashResponse.orderId,
        status: submitRes.data.flashResponse.status,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Submission failed";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll order status
  const handleCancel = async () => {
    if (!order?.providerOrderId) return;
    const cancelMessage = `Definitive Flash v1 — Cancel Order\nOrder: ${order.providerOrderId}`;
    try {
      const userSignature = await wallet.signMessage(cancelMessage);
      const res = await api.cancelOrder(order.id, { cancelMessage, userSignature });
      setOrder(res.data.order);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Cancellation failed");
    }
  };

  const handleRefreshStatus = async () => {
    if (!order) return;
    setIsPolling(true);
    try {
      const res = await api.getOrder(order.id);
      setOrder(res.data.order);
      if (res.data.flashStatus) {
        setFlashStatus(res.data.flashStatus);
      }
    } catch (err) {
      console.warn("Status refresh failed:", err);
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
        <div>
          <div className="text-[10px] uppercase text-[#78716C] tracking-widest flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#16A34A]" />
            // DEFINITIVE FLASH TRADING FLOW
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Social Trade Review & Execution
          </h1>
          <p className="text-xs text-[#78716C] font-sans mt-0.5">
            Assisted copy-trading via Definitive Flash. Review every parameter,
            request a live quote, and confirm with your connected wallet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {config?.configured ? (
            <span className="px-2 py-0.5 rounded-sm bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30 text-[10px] font-bold">
              ⚡ FLASH API CONNECTED
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-sm bg-[#FFE5BF] text-[#78716C] border border-[#E8DFD1] text-[10px] font-bold">
              ⚡ LIVE API KEY PENDING
            </span>
          )}
        </div>
      </div>

      {/* API Key notice if unconfigured */}
      {config && !config.configured && (
        <div className="p-3.5 rounded-sm border border-[#FFE5BF] bg-[#FFF2DB]/60 text-xs text-[#171717] flex items-start gap-3">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Live Definitive API Key Not Detected</div>
            <div className="text-[11px] text-[#78716C] font-sans">
              Set <code className="bg-[#FFE5BF] px-1 py-0.5 rounded">DEFINITIVE_API_KEY</code> in your server <code className="bg-[#FFE5BF] px-1 py-0.5 rounded">.env</code> to execute live quotes and on-chain fills via Flash. The UI below is ready for full parameter review and signing verification.
            </div>
          </div>
        </div>
      )}

      {/* 1. Source Post Attribution Card */}
      {handoffDraft && (
        <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
            <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
              SOURCE STRATEGY EXTRACTED FROM X
            </div>
            {handoffDraft.sourcePost.author && (
              <span className="text-[11px] font-bold text-[#171717]">
                @{handoffDraft.sourcePost.author}
              </span>
            )}
          </div>
          <p className="text-xs text-[#171717] bg-[#FFF2DB]/40 p-2.5 rounded-sm border border-[#E8DFD1] italic">
            &ldquo;{handoffDraft.sourcePost.text}&rdquo;
          </p>
          <div className="flex items-center justify-between text-[10px] text-[#78716C] pt-1">
            <span>
              Classification: <strong className="text-[#171717]">{handoffDraft.classification || "trading_instruction"}</strong>
            </span>
            <span>
              Extracted Confidence: <strong className="text-[#16A34A]">{Math.round((handoffDraft.confidence || 0.8) * 100)}%</strong>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Editable Parameters Form */}
        <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-4">
          <div className="border-b border-[#E8DFD1] pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#171717] uppercase tracking-wide">
                1. Review & Customize Trade Parameters
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wallet.isAuthenticated
                      ? "bg-[#16A34A] animate-pulse"
                      : wallet.address
                        ? "bg-[#EAB308]"
                        : "bg-[#F62440]"
                  }`}
                />
                <span className="text-[#78716C]">
                  {wallet.address
                    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                    : "No wallet"}
                </span>
                {wallet.address && !wallet.isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => void wallet.connect()}
                    className="text-[#F62440] font-bold underline ml-1"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#78716C] font-sans">
              Adjust size, slippage, and limit boundaries to match your risk limits.
            </p>
          </div>

          {/* Chain Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#78716C] font-bold">
              Execution Chain
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(VERIFIED_CHAINS) as [string, { name: string; chainId: number; explorerBaseUrl: string }][]).map(([key, chain]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, chain: key }))}
                  className={`px-3 py-2 rounded-sm border text-xs font-bold transition text-center ${
                    form.chain === key
                      ? "bg-[#171717] text-[#FFFAF3] border-[#171717]"
                      : "bg-[#FFF2DB]/40 text-[#78716C] border-[#E8DFD1] hover:border-[#171717]"
                  }`}
                >
                  {chain.name}
                </button>
              ))}
            </div>
          </div>

          {/* Direction & Order Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#78716C] font-bold">
                Direction
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, side: "buy" }))}
                  className={`py-1.5 rounded-sm border text-xs font-bold transition ${
                    form.side === "buy"
                      ? "bg-[#16A34A] text-white border-[#16A34A]"
                      : "bg-[#FFF2DB]/40 text-[#78716C] border-[#E8DFD1]"
                  }`}
                >
                  BUY / LONG
                </button>
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, side: "sell" }))}
                  className={`py-1.5 rounded-sm border text-xs font-bold transition ${
                    form.side === "sell"
                      ? "bg-[#F62440] text-white border-[#F62440]"
                      : "bg-[#FFF2DB]/40 text-[#78716C] border-[#E8DFD1]"
                  }`}
                >
                  SELL / SHORT
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#78716C] font-bold">
                Order Type
              </label>
              <select
                value={form.orderType}
                onChange={(event) =>
                  setForm((s) => ({
                    ...s,
                    orderType: event.target.value as FlashOrderChoice,
                    side:
                      event.target.value === "stop-loss" ||
                      event.target.value === "take-profit" ||
                      event.target.value === "bracket"
                        ? "sell"
                        : s.side,
                  }))
                }
                className="w-full rounded-sm border border-[#E8DFD1] bg-white px-2 py-2 text-xs"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stop-loss">Stop loss</option>
                <option value="take-profit">Take profit</option>
                <option value="bracket">Bracket</option>
                <option value="twap">TWAP</option>
              </select>
              <p className="text-[10px] text-[#78716C] font-sans">
                DCA is not a separate Flash order type. A triggered market exit can fill at a worse price than the trigger.
              </p>
            </div>
          </div>

          {/* Tokens & Verified Addresses */}
          <div className="space-y-2 bg-[#FFF2DB]/30 p-2.5 rounded-sm border border-[#E8DFD1]">
            <div className="text-[10px] uppercase text-[#78716C] font-bold">
              Verified Asset Mapping ({form.chain.toUpperCase()})
            </div>
            <div className="text-xs flex items-center justify-between">
              <div>
                <span className="text-[#78716C]">Target Asset: </span>
                <strong className="text-[#171717]">{selectedTargetAsset?.symbol}</strong>
              </div>
              <a
                href={`${chainMeta?.explorerBaseUrl}/token/${selectedTargetAsset?.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#16A34A] flex items-center gap-0.5 hover:underline"
              >
                {selectedTargetAsset?.address.slice(0, 8)}...{selectedTargetAsset?.address.slice(-6)}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="text-xs flex items-center justify-between">
              <div>
                <span className="text-[#78716C]">Contra / Spent: </span>
                <strong className="text-[#171717]">{selectedContraAsset?.symbol}</strong>
              </div>
              <a
                href={`${chainMeta?.explorerBaseUrl}/token/${selectedContraAsset?.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#16A34A] flex items-center gap-0.5 hover:underline"
              >
                {selectedContraAsset?.address.slice(0, 8)}...{selectedContraAsset?.address.slice(-6)}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Spend Amount & Limit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#78716C] font-bold">
                Spend Amount ({form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol})
              </label>
              <input
                type="text"
                value={form.qty}
                onChange={(e) => setForm((s) => ({ ...s, qty: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717]"
                placeholder="Your size, not the trader's"
              />
              {handoffDraft && (
                <p className="text-[10px] text-[#78716C]">Your amount. The post does not set position size.</p>
              )}
            </div>

            {form.orderType === "limit" ? (
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#78716C] font-bold">
                  Limit Price (USD)
                </label>
                <input
                  type="text"
                  value={form.limitPrice}
                  onChange={(e) => setForm((s) => ({ ...s, limitPrice: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717]"
                  placeholder="2400"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#78716C] font-bold">
                  Max Slippage
                </label>
                <select
                  value={form.maxSlippage}
                  onChange={(e) => setForm((s) => ({ ...s, maxSlippage: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs font-bold text-[#171717]"
                >
                  <option value="0.005">0.5%</option>
                  <option value="0.01">1.0%</option>
                  <option value="0.02">2.0%</option>
                </select>
              </div>
            )}
          </div>

          {(form.orderType === "stop" || form.orderType === "stop-loss" || form.orderType === "bracket" || form.attachProtection) && (
            <label className="block space-y-1 text-[10px] uppercase text-[#78716C] font-bold">
              Stop {handoffDraft?.stopLoss ? "(from post, editable)" : ""}
              <input
                value={form.stopPrice}
                onChange={(event) => setForm((s) => ({ ...s, stopPrice: event.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs"
              />
            </label>
          )}
          {(form.orderType === "take-profit" || form.orderType === "bracket" || form.attachProtection) && (
            <label className="block space-y-1 text-[10px] uppercase text-[#78716C] font-bold">
              Take profit {handoffDraft?.takeProfit ? "(from post, editable)" : ""}
              <input
                value={form.takeProfitPrice}
                onChange={(event) => setForm((s) => ({ ...s, takeProfitPrice: event.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs"
              />
            </label>
          )}
          {form.orderType === "twap" && (
            <label className="block space-y-1 text-[10px] uppercase text-[#78716C] font-bold">
              TWAP minutes (minimum 5)
              <input
                value={form.twapMinutes}
                onChange={(event) => setForm((s) => ({ ...s, twapMinutes: event.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-white text-xs"
              />
            </label>
          )}
          {["market", "limit", "twap"].includes(form.orderType) && (
            <label className="flex items-center gap-2 text-[11px] text-[#171717]">
              <input
                type="checkbox"
                checked={form.attachProtection}
                onChange={(event) => setForm((s) => ({ ...s, attachProtection: event.target.checked }))}
              />
              Attach stop-loss and take-profit to the asset this order receives
            </label>
          )}

          {/* Funding Balance / Chain Guidance */}
          <div className="text-[11px] text-[#78716C] bg-[#FFF2DB]/40 border border-[#E8DFD1] p-2.5 rounded-sm space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#171717]">
              <Info className="w-3.5 h-3.5 text-[#78716C]" />
              <span>Chain &amp; Asset Note</span>
            </div>
            <p className="leading-relaxed">
              Order will settle on <strong className="text-[#171717]">{chainMeta?.name}</strong> spending{" "}
              <strong className="text-[#171717]">{form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol}</strong>.
              {form.chain === "base" && (
                <span className="block text-[10px] text-[#A16207] mt-0.5">
                  Notice: If your USDC is on Ethereum Mainnet, select Ethereum above or swap ETH into USDC on Base.
                </span>
              )}
            </p>
          </div>

          {/* Action Button */}
          {!wallet.isAuthenticated && !wallet.address ? (
            <button
              type="button"
              onClick={() => void wallet.connect()}
              disabled={wallet.isConnecting}
              className="w-full py-2.5 rounded-sm bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {wallet.isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>CONNECTING WALLET...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5" />
                  <span>CONNECT WALLET TO REQUEST QUOTE</span>
                </>
              )}
            </button>
          ) : !wallet.isAuthenticated ? (
            <button
              type="button"
              onClick={() => void wallet.connect()}
              disabled={wallet.isConnecting}
              className="w-full py-2.5 rounded-sm bg-[#EAB308] hover:bg-[#CA8A04] text-black text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {wallet.isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>VERIFYING SIGNATURE IN METAMASK...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SIGN IN TO VERIFY ({wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)})</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRequestQuote}
              disabled={isQuoting}
              className="w-full py-2.5 rounded-sm bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isQuoting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>REQUESTING LIVE FLASH QUOTE...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>REQUEST LIVE QUOTE FROM FLASH</span>
                </>
              )}
            </button>
          )}

          {quoteError && (
            <div className="p-2.5 rounded-sm bg-[#F62440]/10 border border-[#F62440]/30 text-xs text-[#F62440]">
              {quoteError}
            </div>
          )}
        </div>

        {/* Right Column: Quote Review, Wallet Signing & Order State */}
        <div className="space-y-4">
          {/* Quote Card */}
          {quote ? (
            <div className="border border-[#16A34A] bg-[#FFFAF3] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
                <div className="text-[10px] uppercase text-[#16A34A] font-bold tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  2. LIVE FLASH QUOTE LOCKED
                </div>
                <span className="text-[10px] text-[#78716C]">
                  ID: {quote.quoteId.slice(0, 10)}...
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFF2DB]/40 p-3 rounded-sm border border-[#E8DFD1]">
                <div>
                  <div className="text-[9px] text-[#78716C] uppercase">
                    You Spend
                  </div>
                  <div className="font-bold text-[#171717] mt-0.5">
                    {quote.qty} {form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-[#78716C] uppercase">
                    Expected Output
                  </div>
                  <div className="font-bold text-[#16A34A] mt-0.5">
                    {quote.to?.amount || quote.expectedOutputAmount || "Unavailable"} {form.side === "buy" ? selectedTargetAsset?.symbol : selectedContraAsset?.symbol}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-[#78716C] uppercase">
                    Order Strategy
                  </div>
                  <div className="font-bold text-[#171717] mt-0.5 uppercase">
                    {quote.orderType} {quote.limitNotionalPrice ? `@ $${quote.limitNotionalPrice}` : ""}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-[#78716C] uppercase">
                    Estimated Fee
                  </div>
                  <div className="font-bold text-[#171717] mt-0.5">
                    {quote.fees?.estimatedFeeNotional ? `$${quote.fees.estimatedFeeNotional}` : "Unavailable"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[#78716C]">
                <div>Price impact: {quote.estimatedPriceImpact ?? quote.priceImpactPercentage ?? "Unavailable"}</div>
                <div>Recommended slippage: {quote.recommendedSlippage ?? "Unavailable"}</div>
                <div>Expires: {quote.validUntil ? new Date(quote.validUntil).toLocaleString() : "Not returned"}</div>
                <div>Setup txs: {quote.setupTxs?.length ?? (quote.evm?.approveTx ? 1 : 0)}</div>
              </div>

              {/* Step 2A: Wrap Native Asset Notice (if needed) */}
              {quote.wrap?.evmTx && !isWrapped && (
                <div className="p-3 rounded-sm bg-[#FFF2DB] border border-[#EAB308] text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#854D0E]">
                    <AlertTriangle className="w-4 h-4 text-[#EAB308]" />
                    <span>Native Token Wrapping Required</span>
                  </div>
                  <p className="text-[#78716C] text-[11px] leading-relaxed">
                    Flash requires wrapped tokens (e.g. WETH) for non-custodial limit and market routing on {chainMeta?.name}.
                  </p>
                  {wrapTxHash && (
                    <div className="text-[10px] font-mono text-[#16A34A] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Wrap Tx Sent: {wrapTxHash.slice(0, 10)}...</span>
                      <a
                        href={`${chainMeta?.explorerBaseUrl}/tx/${wrapTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#171717] underline ml-1"
                      >
                        Explorer ↗
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleWrapToken}
                    disabled={isWrapping}
                    className="w-full py-2 rounded-sm bg-[#EAB308] hover:bg-[#CA8A04] text-black font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    {isWrapping ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>WRAPPING TOKEN IN METAMASK...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>EXECUTE WRAP TRANSACTION</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 2B: Token Approval Notice (Required by Definitive Flash for ERC-20s) */}
              {quote.evm?.approveTx && !isApproved && (
                <div className="p-3 rounded-sm bg-[#FFF2DB] border border-[#EAB308] text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#854D0E]">
                    <ShieldCheck className="w-4 h-4 text-[#EAB308]" />
                    <span>One-Time Token Approval Required</span>
                  </div>
                  <p className="text-[#78716C] text-[11px] leading-relaxed">
                    Before Flash can execute your trade, you must approve the Definitive settlement contract to spend your{" "}
                    <strong>{form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol}</strong> on {chainMeta?.name}. This is only done once per token.
                  </p>
                  {approvalTxHash && (
                    <div className="text-[10px] font-mono text-[#16A34A] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approval Tx: {approvalTxHash.slice(0, 10)}... (Confirming)</span>
                      <a
                        href={`${chainMeta?.explorerBaseUrl}/tx/${approvalTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#171717] underline ml-1"
                      >
                        BaseScan ↗
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleApproveToken}
                    disabled={isApproving}
                    className="w-full py-2 rounded-sm bg-[#EAB308] hover:bg-[#CA8A04] text-black font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    {isApproving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>APPROVING IN METAMASK...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          1. APPROVE {form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol} IN METAMASK
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="p-2.5 rounded-sm bg-[#FFF2DB]/60 border border-[#E8DFD1] text-[11px] text-[#78716C] font-sans flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#171717] shrink-0 mt-0.5" />
                <span>
                  <strong>Non-Custodial EIP-712 Order:</strong>{" "}
                  {quote.evm?.approveTx && !isApproved
                    ? "Complete token approval above, then cryptographically sign the Flash order."
                    : `Clicking below will prompt your connected wallet (${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}) to cryptographically sign the exact Flash order parameters.`}
                </span>
              </div>

              {/* Confirm & Sign / Execute Button */}
              {!order ? (
                <button
                  type="button"
                  onClick={handleSignAndSubmit}
                  disabled={isSigning || isSubmitting || isApproving || isWrapping}
                  className={`w-full py-2.5 rounded-sm text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                    quote.evm?.approveTx && !isApproved
                      ? "bg-[#EAB308] hover:bg-[#CA8A04] text-black"
                      : "bg-[#16A34A] hover:bg-[#15803D]"
                  }`}
                >
                  {isApproving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>APPROVING TOKEN IN METAMASK...</span>
                    </>
                  ) : isWrapping ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>WRAPPING NATIVE TOKEN...</span>
                    </>
                  ) : isSigning ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>SIGNING ORDER IN WALLET...</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>BROADCASTING TO FLASH...</span>
                    </>
                  ) : quote.wrap?.evmTx && !isWrapped ? (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>WRAP NATIVE TOKEN IN METAMASK</span>
                    </>
                  ) : quote.evm?.approveTx && !isApproved ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        1. APPROVE {form.side === "buy" ? selectedContraAsset?.symbol : selectedTargetAsset?.symbol} IN METAMASK
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        {quote.evm?.approveTx ? "2. CONFIRM & SIGN ORDER WITH WALLET" : "CONFIRM & SIGN WITH WALLET"}
                      </span>
                    </>
                  )}
                </button>
              ) : null}

              {signingError && (
                <div className="p-2 rounded-sm bg-[#F62440]/10 border border-[#F62440]/30 text-xs text-[#F62440]">
                  {signingError}
                </div>
              )}
              {submitError && (
                <div className="p-2 rounded-sm bg-[#F62440]/10 border border-[#F62440]/30 text-xs text-[#F62440]">
                  {submitError}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-[#E8DFD1] bg-[#FFFAF3]/50 rounded-sm p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-[#78716C] mx-auto opacity-50" />
              <div className="text-xs font-bold text-[#171717] uppercase">
                Awaiting Parameter Confirmation
              </div>
              <p className="text-[11px] text-[#78716C] font-sans max-w-xs mx-auto">
                Review your execution parameters on the left and click &ldquo;Request Live Quote&rdquo; to query Definitive Flash pricing.
              </p>
            </div>
          )}

          {/* Submitted Order Status & On-Chain Execution Card */}
          {order && (
            <div className="border border-[#171717] bg-[#FFFAF3] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
                <div className="text-[10px] uppercase text-[#171717] font-bold tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                  3. SUBMITTED ORDER &amp; ON-CHAIN EVIDENCE
                </div>
                {["PENDING", "SUBMITTED", "PARTIALLY_FILLED"].includes(order.status) && (
                  <button type="button" onClick={() => void handleCancel()} className="text-[10px] font-bold text-[#F62440]">
                    CANCEL
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={isPolling}
                  className="text-[10px] text-[#78716C] hover:text-[#171717] flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isPolling ? "animate-spin" : ""}`} />
                  REFRESH
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C]">Provider Order ID:</span>
                  <span className="font-bold text-[#171717]">
                    {order.providerOrderId || flashStatus?.orderId}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#78716C]">Execution State:</span>
                  <span className="px-2 py-0.5 rounded-sm bg-[#171717] text-[#FFFAF3] text-[10px] font-bold uppercase">
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#78716C]">Settlement Chain:</span>
                  <span className="font-bold text-[#171717] uppercase">
                    {order.chainId}
                  </span>
                </div>

                {order.transactionHash ? (
                  <div className="mt-3 p-3 rounded-sm bg-[#16A34A]/10 border border-[#16A34A]/40 space-y-1.5">
                    <div className="text-[10px] text-[#16A34A] font-bold uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ON-CHAIN SETTLEMENT CONFIRMED
                    </div>
                    <div className="text-[11px] font-mono break-all text-[#171717]">
                      {order.transactionHash}
                    </div>
                    <a
                      href={`${chainMeta?.explorerBaseUrl}/tx/${order.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#16A34A] flex items-center gap-1 hover:underline pt-0.5"
                    >
                      <span>VIEW ON {chainMeta?.name.toUpperCase()} EXPLORER</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-sm bg-[#FFF2DB]/60 border border-[#E8DFD1] text-[11px] text-[#78716C] font-sans">
                    Order broadcast to Definitive Flash router. Awaiting on-chain block inclusion. Refresh above to poll latest fill status.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto p-12 text-center text-xs font-mono text-[#78716C]">
          Loading trade execution environment...
        </div>
      }
    >
      <TradeContent />
    </Suspense>
  );
}
