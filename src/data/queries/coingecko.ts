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
      const { data } = await axios.get("currencies.json", {
        baseURL: STATION_ASSETS,
      })
      return data as { name: string; symbol: string; id: string }[]
    },
    { ...RefetchOptions.INFINITY },
  )
}

interface ExternalPrice {
  usd: number
  change24h: number
}

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

type PriceObject = Record<
  string,
  {
    price: number
    change: number
  }
>

const COINGECKO_IDS: Record<string, string> = {
  uluna: "terra",
  uluna_classic: "terra-luna-classic",
  uusd: "terraclassicusd",
}

const queryStationAliases = async () => {
  try {
    const { data } = await axios.get<Record<string, string>>(
      "station/tfm.json",
      {
        baseURL: ASSETS,
        timeout: 10000,
      },
    )

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Invalid station/tfm.json response format")
      return {}
    }

    return data
  } catch (error) {
    console.warn("Failed to load station aliases", error)
    return {}
  }
}

const queryCoinGeckoPrices = async (): Promise<
  Record<string, ExternalPrice>
> => {
  try {
    const ids = Array.from(new Set(Object.values(COINGECKO_IDS)))
    if (!ids.length) return {}

    const { data } = await axios.get<
      Record<string, { usd?: number; usd_24h_change?: number }>
    >("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: ids.join(","),
        vs_currencies: "usd",
        include_24hr_change: true,
      },
      timeout: 10000,
    })

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Invalid CoinGecko price response format")
      return {}
    }

    const result: Record<string, ExternalPrice> = {}

    Object.entries(COINGECKO_IDS).forEach(([denom, id]) => {
      const entry = data[id]
      result[denom] = {
        usd: entry?.usd ?? 0,
        change24h: entry?.usd_24h_change ?? 0,
      }
    })

    return result
  } catch (error) {
    console.warn("Failed to load CoinGecko prices", error)
    return {}
  }
}

// CoinMarketCap must not be called directly from the frontend due to CORS.
// Backend recovery can be added separately later.
const queryCMCPrices = async (): Promise<Record<string, ExternalPrice>> => {
  return {}
}

const queryFiatPrice = async (currencyId: string) => {
  if (currencyId === "USD") return 1

  try {
    const { data } = await axios.get<{
      quotes?: Record<string, number>
    }>(
      `https://apilayer.net/api/live?source=USD&currencies=${currencyId}&access_key=${CURRENCY_KEY}`,
      {
        timeout: 10000,
      },
    )

    return data?.quotes?.[`USD${currencyId}`] ?? 1
  } catch (error) {
    console.warn(`Failed to load fiat conversion for ${currencyId}`, error)
    return 1
  }
}

export const useExchangeRates = () => {
  const currency = useCurrency()
  const isClassic = useNetworkName() === "classic"

  return useQuery(
    [queryKey.coingecko.exchangeRates, currency, isClassic],
    async () => {
      const [stationAliases, coinGeckoPrices, cmcPrices, fiatPrice] =
        await Promise.all([
          queryStationAliases(),
          queryCoinGeckoPrices(),
          queryCMCPrices(),
          queryFiatPrice(currency.id),
        ])

      const mergedPrices: Record<string, ExternalPrice> = {
        ...coinGeckoPrices,
      }

      Object.entries(cmcPrices).forEach(([denom, value]) => {
        const current = mergedPrices[denom]
        if (!current || !current.usd) {
          mergedPrices[denom] = value
        }
      })

      const priceObject: PriceObject = Object.fromEntries(
        Object.entries(mergedPrices ?? {}).map(([denom, value]) => {
          const usd = value?.usd ?? 0
          const change24h = value?.change24h ?? 0

          if (denom === "uluna" && isClassic) {
            return [
              denom,
              {
                price: (mergedPrices?.uluna_classic?.usd ?? 0) * fiatPrice,
                change: mergedPrices?.uluna_classic?.change24h ?? 0,
              },
            ]
          }

          return [
            AXELAR_TOKENS[denom] ?? denom,
            {
              price: usd * fiatPrice,
              change: change24h,
            },
          ]
        }),
      )

      if (!priceObject["uluna:classic"] && mergedPrices?.uluna_classic) {
        priceObject["uluna:classic"] = {
          price: (mergedPrices.uluna_classic.usd ?? 0) * fiatPrice,
          change: mergedPrices.uluna_classic.change24h ?? 0,
        }
      }

      Object.entries(stationAliases ?? {}).forEach(([key, value]) => {
        if (!priceObject[key] && priceObject[value]) {
          priceObject[key] = {
            ...priceObject[value],
          }
        }
      })

      Object.entries(STAKED_TOKENS ?? {}).forEach(([key]) => {
        if (!priceObject[key]) {
          priceObject[key] = {
            price: 100,
            change: 0,
          }
        }
      })

      return priceObject
    },
    {
      ...RefetchOptions.DEFAULT,
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
