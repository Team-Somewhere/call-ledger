import { z } from "zod";

/** Validation for external market-data responses. Unknown fields are ignored; required fields must be present. */

export const dexPairSchema = z.object({
  chainId: z.string(),
  dexId: z.string().optional(),
  url: z.string().optional(),
  pairAddress: z.string(),
  baseToken: z.object({ address: z.string(), name: z.string(), symbol: z.string() }),
  quoteToken: z.object({ address: z.string(), name: z.string(), symbol: z.string() }).optional(),
  priceUsd: z.string().nullish(),
  priceChange: z.record(z.string(), z.number().nullish()).nullish(),
  liquidity: z.object({ usd: z.number().nullish() }).nullish(),
  volume: z.record(z.string(), z.number().nullish()).nullish(),
  marketCap: z.number().nullish(),
  fdv: z.number().nullish(),
  info: z.object({ imageUrl: z.string().optional() }).passthrough().nullish(),
});
export type DexPair = z.infer<typeof dexPairSchema>;

export const dexSearchSchema = z.object({
  pairs: z.array(dexPairSchema.passthrough()).nullable().optional(),
});

export const geckoTokenSchema = z.object({
  data: z.object({
    id: z.string(),
    attributes: z.object({
      address: z.string(),
      name: z.string().nullish(),
      symbol: z.string().nullish(),
      decimals: z.number().nullish(),
      image_url: z.string().nullish(),
      price_usd: z.string().nullish(),
      market_cap_usd: z.string().nullish(),
      fdv_usd: z.string().nullish(),
      total_reserve_in_usd: z.string().nullish(),
      volume_usd: z.record(z.string(), z.string().nullish()).nullish(),
    }).passthrough(),
  }),
});

export const geckoPoolsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      attributes: z.object({
        address: z.string(),
        name: z.string().nullish(),
        reserve_in_usd: z.string().nullish(),
        base_token_price_usd: z.string().nullish(),
        price_change_percentage: z.record(z.string(), z.string().nullish()).nullish(),
      }).passthrough(),
    }),
  ),
});

/** OHLCV: list of [timestamp_seconds, open, high, low, close, volume]. */
export const geckoOhlcvSchema = z.object({
  data: z.object({
    attributes: z.object({
      ohlcv_list: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()])),
    }),
  }),
});

export const fxRateSchema = z.object({
  result: z.literal("success"),
  rates: z.object({ INR: z.number().positive().finite() }).passthrough(),
  time_last_update_utc: z.string().optional(),
});
