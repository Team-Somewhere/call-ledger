import {
  createDefinitiveClient,
  type IDefinitiveClient,
} from "@call-ledger/definitive";
import { env } from "../config/env";

let definitiveClientInstance: IDefinitiveClient | null = null;

export function getDefinitiveClient(): IDefinitiveClient {
  if (!definitiveClientInstance) {
    definitiveClientInstance = createDefinitiveClient({
      apiKey: env.DEFINITIVE_API_KEY,
      baseUrl: env.DEFINITIVE_BASE_URL,
    });
  }
  return definitiveClientInstance;
}

export function setDefinitiveClientForTesting(client: IDefinitiveClient | null): void {
  definitiveClientInstance = client;
}

export function isDefinitiveConfigured(): boolean {
  return getDefinitiveClient().isConfigured();
}
