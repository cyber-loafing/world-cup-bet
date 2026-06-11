import { createClient } from "@insforge/sdk";

export const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
export const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? "";
export const isInsForgeConfigured = Boolean(insforgeUrl && insforgeAnonKey);

export const insforge = isInsForgeConfigured
  ? createClient({
      baseUrl: insforgeUrl,
      anonKey: insforgeAnonKey,
    })
  : null;
