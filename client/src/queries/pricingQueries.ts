import { api } from "@/lib/api";

export const pricingQueryKey = ["pricing"] as const;

export const pricingQueryOptions = {
  queryKey: pricingQueryKey,
  queryFn: () => api.getPricing(),
  staleTime: 0,
  gcTime: 60_000,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
};

export function pickPrimaryPricePoint<T extends { amountPaise: number; isActive?: boolean; sortOrder?: number }>(
  pricePoints: T[] | undefined
): T | undefined {
  if (!pricePoints?.length) return undefined;
  const active = pricePoints.filter((p) => p.isActive !== false);
  const list = active.length ? active : pricePoints;
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
}
