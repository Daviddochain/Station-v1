import { useQuery } from "react-query"
import request from "axios"
import { queryKey } from "../query"

// https://api-osmosis.imperator.co/swagger/
export const OSMOSIS_API_URL = "https://api-osmosis.imperator.co"

export const GAMM_TOKEN_DECIMALS = 18
export const OSMO_ICON =
  "https://station-assets.terra.dev/img/chains/Osmosis.svg"

interface IOsmosisPoolAsset {
  symbol: string
  amount: number
  denom: string
  coingecko_id: string
  liquidity: number
  liquidity_24h_change: number
  volume_24h: number
  volume_24h_change: number
  volume_7d: number
  price: number
  fees: string
}

interface IOsmosisPoolResponse {
  // pool_id: pool asset array
  [key: string]: IOsmosisPoolAsset[]
}

/**
 * Map token name to gamm denoms
 * e.g. gamm/pool/1 -> ATOM-OSMO LP
 *
 * @returns a map of token name strings indexed by gamm denom
 */
export const useGammTokens = () => {
  const fetch = useQuery<IOsmosisPoolResponse>(
    [queryKey.gammTokens],
    async () => {
      try {
        const response = await request.get<IOsmosisPoolResponse>(
          "/pools/v2/all?low_liquidity=true",
          { baseURL: OSMOSIS_API_URL },
        )

        const data = response?.data

        if (!data || typeof data !== "object") {
          console.error("Invalid Osmosis API response format")
          return {}
        }

        return data
      } catch (error) {
        console.error("Failed to fetch Osmosis pool data:", error)
        return {}
      }
    },
    {
      // Data will never become stale and always stay in cache
      cacheTime: Infinity,
      staleTime: Infinity,
    },
  )

  const gammTokens = new Map<string, string>()

  if (fetch.data && typeof fetch.data === "object") {
    for (const [poolId, poolAsset] of Object.entries(fetch.data)) {
      if (Array.isArray(poolAsset)) {
        gammTokens.set(
          "gamm/pool/" + poolId,
          poolAsset.map((asset) => asset.symbol).join("-") + " LP",
        )
      } else {
        console.error("Invalid pool asset format for pool:", poolId)
      }
    }
  }

  return gammTokens
}
