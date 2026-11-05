import type {
  SignalClassification,
  SignalDirection,
  SignalStatus,
  VerificationOutcome,
  VerificationStatus,
} from "../constants/statuses";

export interface Signal {
  id: string;
  creatorId: string;
  sourcePostId: string | null;
  assetSymbol: string;
  assetAddress: string | null;
  chainId: number | string | null;
  direction: SignalDirection;
  entryPrice: string | null;
  takeProfit: string | null;
  stopLoss: string | null;
  timeframe: string | null;
  confidence: string | null;
  classification: SignalClassification;
  signalStatus: SignalStatus;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignalVerification {
  id: string;
  signalId: string;
  verificationStatus: VerificationStatus;
  entryPrice: string | null;
  exitPrice: string | null;
  returnPercentage: string | null;
  outcome: VerificationOutcome | null;
  verificationMethod: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface SignalWithVerification extends Signal {
  verification?: SignalVerification | null;
  creator?: {
    id: string;
    displayName: string;
    xUsername: string;
    avatarUrl: string | null;
  };
}
