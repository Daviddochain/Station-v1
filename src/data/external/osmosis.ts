import { useQuery } from "react-query"
import request from "axios"
import { queryKey } from "../query"

// Official public Osmosis LCD from Osmosis docs
export const OSMOSIS_LCD_URL = "https://lcd.osmosis.zone"

export const GAMM_TOKEN_DECIMALS = 18
export const OSMO_ICON =
  "https://station-assets.terra.dev/img/chains/Osmosis.svg"

interface IOsmosisPoolAsset {
  token?: {
    denom?: string
    amount?: string
  }
  weight?: string
}

interface IOsmosisPool {
  "@type"?: string
  id?: string
  pool_assets?: IOsmosisPoolAsset[]
}

interface IOsmosisPoolsResponse {
  pools?: IOsmosisPool[]
  pagination?: {
    next_key?: string | null
    total?: string
  }
}

/**
 * Map token name to gamm denoms
 * e.g. gamm/pool/1 -> ATOM-OSMO LP
 *
 * Uses official Osmosis LCD instead of dead Imperator-style APIs.
 */
export const useGammTokens = () => {
  const fetch = useQuery<IOsmosisPoolsResponse>(
    [queryKey.gammTokens],
    async () => {
      try {
        const response = await request.get<IOsmosisPoolsResponse>(
          `${OSMOSIS_LCD_URL}/osmosis/gamm/v1beta1/pools`,
          {
            params: { "pagination.limit": 1000 },
            timeout: 10000,
          },
        )

        const data = response?.data

        if (!data || typeof data !== "object" || !Array.isArray(data.pools)) {
          console.warn("Invalid Osmosis LCD response format")
          return { pools: [] }
        }

        return data
      } catch (error) {
        console.warn("Failed to fetch Osmosis pool data:", error)
        return { pools: [] }
      }
    },
    {
      cacheTime: Infinity,
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    },
  )

  const gammTokens = new Map<string, string>()

  const pools = fetch.data?.pools ?? []

  for (const pool of pools) {
    const poolId = pool?.id
    const assets = pool?.pool_assets ?? []

    if (!poolId || !Array.isArray(assets) || assets.length === 0) continue

    const symbols = assets
      .map((asset) => asset?.token?.denom)
      .filter((denom): denom is string => !!denom)
      .map((denom) => {
        if (denom === "uosmo") return "OSMO"
        return denom.replace(/^u/, "").toUpperCase()
      })

    if (!symbols.length) continue

    gammTokens.set(`gamm/pool/${poolId}`, `${symbols.join("-")} LP`)
  }

  return gammTokens
}
