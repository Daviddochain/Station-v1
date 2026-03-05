import { useCallback } from "react"
import { useQuery } from "react-query"
import { queryKey, RefetchOptions } from "../query"
import { CURRENCY_KEY, STATION_ASSETS, ASSETS } from "config/constants"
import axios from "axios"
import { useCurrency } from "data/settings/Currency"
import { useNetworkName } from "data/wallet"

// TODO: remove/move somewhere else
export const useActiveDenoms = () => {
  return useQuery(
    [queryKey.coingecko.activeDenoms],
    async () => {
      return ["uluna"]
    },
    { ...RefetchOptions.INFINITY },
  )
}

export const useSupportedFiat = () => {
  return useQuery(
    [queryKey.coingecko.supportedFiat],
    async () => {
      try {
        const res = await axios.get("currencies.json", {
          baseURL: STATION_ASSETS,
          timeout: 10000,
        })
        return (res?.data ?? []) as {
          name: string
          symbol: string
          id: string
        }[]
      } catch {
        return []
      }
    },
    { ...RefetchOptions.INFINITY, retry: false },
  )
}

/** CoinGecko response: { "<id>": { "<vs>": number, "<vs>_24h_change": number } } */
type CoinGeckoSimplePrice = Record<string, Record<string, number>>

// TODO: remove hardcoded denoms
const AXELAR_TOKENS: Record<string, string> = {
  "ibc/B3504E092456BA618CC28AC671A71FB08C6CA0FD0BE7C8A5B5A3E2DD933CC9E4":
    "uusdc",
  "ibc/CBF67A2BCF6CAE343FDF251E510C8E18C361FC02B23430C121116E0811835DEF":
    "uusdt",
}

const STAKED_TOKENS: Record<string, string> = {
  terra1jltsv4zjps5veugu6xc0gkurrjx33klhyxse80hy8pszzvhslx0s2n7jkk: "sORD",
  terra1lertn5hx2gpw940a0sspds6kydja3c07x0mfg0xu66gvu9p4l30q7ttd2p: "sCOR",
  terra15rqy5xh7sclu3yltuz8ndl8lzudcqcv3laldxxsxaph085v6mdpqdjrucv: "sATR",
  terra14y9aa87v4mjvpf0vu8xm7nvldvjvk4h3wly2240u0586j4l6qm2q7ngp7t: "sHAR",
}

const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Fetch CoinGecko prices (USD base) for a list of CoinGecko IDs.
 * We request include_24hr_change so we can keep the old { usd, change24h } shape.
 */
const fetchCoinGeckoUSD = async (ids: string[]) => {
  if (!ids.length) return {} as CoinGeckoSimplePrice

  const result: CoinGeckoSimplePrice = {}
  const batches = chunk(Array.from(new Set(ids)).filter(Boolean), 200) // keep URLs sane

  for (const batch of batches) {
    try {
      const res = await axios.get<CoinGeckoSimplePrice>(
        "https://api.coingecko.com/api/v3/simple/price",
        {
          params: {
            ids: batch.join(","),
            vs_currencies: "usd",
            include_24hr_change: true,
          },
          timeout: 15000,
        },
      )

      Object.assign(result, res?.data ?? {})
    } catch {
      // If a batch fails (rate limit / network), keep going with what we have
    }
  }

  return result
}

/**
 * Returns a denom-> {price, change} map.
 * - Uses CoinGecko (official) instead of TFM (cert issues).
 * - Uses station/tfm.json as the denom->CoinGeckoID mapping file (keeps your existing structure).
 */
export const useExchangeRates = () => {
  const currency = useCurrency()
  const isClassic = useNetworkName() === "classic"

  return useQuery(
    [queryKey.coingecko.exchangeRates, currency, isClassic],
    async () => {
      // 1) Load denom -> CoinGecko ID mapping from your existing assets file
      let ID_MAP: Record<string, string> = {}
      try {
        const res = await axios.get<Record<string, string>>(
          "station/tfm.json",
          {
            baseURL: ASSETS,
            timeout: 10000,
          },
        )
        ID_MAP = res?.data ?? {}
      } catch {
        ID_MAP = {}
      }

      // 2) Fiat conversion (USD -> selected currency)
      const fiatPrice = await (async () => {
        if (currency.id === "USD") return 1

        try {
          const res = await axios.get<{ quotes: Record<string, number> }>(
            `https://apilayer.net/api/live`,
            {
              params: {
                source: "USD",
                currencies: currency.id,
                access_key: CURRENCY_KEY,
              },
              timeout: 10000,
            },
          )

          return res?.data?.quotes?.[`USD${currency.id}`] ?? 1
        } catch {
          return 1
        }
      })()

      // 3) Build the set of CoinGecko IDs we need
      // Special-case uluna:
      // - classic uses LUNC id "terra-luna-classic"
      // - non-classic uses LUNA id "terra-luna-2"
      const idsToFetch = new Set<string>()

      Object.keys(ID_MAP ?? {}).forEach((denom) => {
        const mapped = ID_MAP[denom]
        if (mapped) idsToFetch.add(mapped)
      })

      // ensure these are always fetchable for the uluna special-case
      idsToFetch.add("terra-luna-classic")
      idsToFetch.add("terra-luna-2")

      // 4) Fetch CoinGecko USD price + 24h change
      const cg = await fetchCoinGeckoUSD(Array.from(idsToFetch))

      // 5) Convert CoinGecko response into the old priceObject shape
      const priceObject: Record<string, { price: number; change: number }> = {}

      const getCg = (id: string) => {
        const row = cg?.[id] ?? {}
        const usd = Number(row.usd ?? 0)
        const change24h = Number(row.usd_24h_change ?? 0)
        return { usd, change24h }
      }

      Object.entries(ID_MAP ?? {}).forEach(([denom, cgId]) => {
        // Apply denom aliasing used elsewhere in the app (Axelar stablecoins etc.)
        const key = AXELAR_TOKENS[denom] ?? denom

        // Special-case uluna network behaviour
        if (denom === "uluna") {
          const { usd, change24h } = isClassic
            ? getCg("terra-luna-classic")
            : getCg("terra-luna-2")

          priceObject[key] = { price: usd * fiatPrice, change: change24h }
          return
        }

        const { usd, change24h } = getCg(cgId)
        priceObject[key] = { price: usd * fiatPrice, change: change24h }
      })

      // 6) Keep your old “also allow lookup by alt keys” behaviour:
      // If map contains denom aliases, copy values across.
      Object.entries(ID_MAP ?? {}).forEach(([key, value]) => {
        // if key doesn't exist but value-mapped denom exists, copy it
        if (!priceObject[key] && priceObject[value]) {
          priceObject[key] = { ...priceObject[value] }
        }
      })

      // 7) Add staked tokens and set price to 100
      Object.entries(STAKED_TOKENS ?? {}).forEach(([key]) => {
        if (!priceObject[key]) {
          priceObject[key] = { price: 100, change: 0 }
        }
      })

      return priceObject
    },
    {
      ...RefetchOptions.DEFAULT,
      // CoinGecko can rate limit; don't hammer retries in the UI
      retry: false,
      refetchOnWindowFocus: false,
    },
  )
}

/* helpers */
export type CalcValue = (params: CoinData) => number | undefined

export const useMemoizedCalcValue = () => {
  const { data: memoizedPrices } = useExchangeRates()

  return useCallback<CalcValue>(
    ({ amount, denom }) => {
      if (!memoizedPrices) return
      return Number(amount) * Number(memoizedPrices[denom]?.price ?? 0)
    },
    [memoizedPrices],
  )
}
