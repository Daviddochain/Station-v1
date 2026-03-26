import { useCallback } from "react"
import { useQuery } from "react-query"
import { queryKey, RefetchOptions } from "../query"
import { STATION_ASSETS, ASSETS } from "config/constants"
import axios from "axios"
import { useCurrency } from "data/settings/Currency"

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

const normalizeExternalPrice = (entry?: {
  price?: number
  change?: number
  usd?: number
  change24h?: number
}): ExternalPrice => ({
  usd: Number(entry?.usd ?? entry?.price ?? 0),
  change24h: Number(entry?.change24h ?? entry?.change ?? 0),
})

const addPriceAlias = (
  target: Record<string, ExternalPrice>,
  key: string,
  value?: ExternalPrice,
) => {
  if (!key || !value) return
  target[key] = value
}

const queryCMCPrices = async (): Promise<Record<string, ExternalPrice>> => {
  try {
    const response = await axios.get<
      Record<
        string,
        {
          price?: number
          change?: number
          usd?: number
          change24h?: number
        }
      >
    >("http://localhost:3001/api/prices", {
      timeout: 10000,
    })

    const data = response?.data

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Invalid backend price response format", data)
      return {}
    }

    const mapped: Record<string, ExternalPrice> = {}

    Object.entries(data).forEach(([key, value]) => {
      const normalized = normalizeExternalPrice(value)
      mapped[key] = normalized
      mapped[key.toLowerCase()] = normalized
    })

    addPriceAlias(
      mapped,
      "lunc",
      normalizeExternalPrice(
        data["uluna:classic"] ?? data.uluna_classic ?? data.lunc,
      ),
    )
    addPriceAlias(
      mapped,
      "luna2",
      normalizeExternalPrice(
        data["uluna:phoenix"] ?? data.uluna_phoenix ?? data.luna2 ?? data.luna,
      ),
    )
    addPriceAlias(
      mapped,
      "uusd",
      normalizeExternalPrice(data.uusd ?? data.ustc),
    )
    addPriceAlias(
      mapped,
      "ustc",
      normalizeExternalPrice(data.uusd ?? data.ustc),
    )
    addPriceAlias(
      mapped,
      "uusdc",
      normalizeExternalPrice(data.uusdc ?? data.usdc),
    )
    addPriceAlias(
      mapped,
      "uusdt",
      normalizeExternalPrice(data.uusdt ?? data.usdt),
    )
    addPriceAlias(
      mapped,
      "atom",
      normalizeExternalPrice(data.uatom ?? data.atom),
    )
    addPriceAlias(
      mapped,
      "osmo",
      normalizeExternalPrice(data.uosmo ?? data.osmo),
    )
    addPriceAlias(
      mapped,
      "juno",
      normalizeExternalPrice(data.ujuno ?? data.juno),
    )
    addPriceAlias(mapped, "sei", normalizeExternalPrice(data.usei ?? data.sei))
    addPriceAlias(mapped, "inj", normalizeExternalPrice(data.uinj ?? data.inj))
    addPriceAlias(mapped, "akt", normalizeExternalPrice(data.uakt ?? data.akt))
    addPriceAlias(
      mapped,
      "scrt",
      normalizeExternalPrice(data.uscrt ?? data.scrt),
    )
    addPriceAlias(
      mapped,
      "kuji",
      normalizeExternalPrice(data.ukuji ?? data.kuji),
    )
    addPriceAlias(
      mapped,
      "stars",
      normalizeExternalPrice(data.ustars ?? data.stars),
    )
    addPriceAlias(
      mapped,
      "dydx",
      normalizeExternalPrice(data.udydx ?? data.dydx),
    )
    addPriceAlias(
      mapped,
      "ntrn",
      normalizeExternalPrice(data.untrn ?? data.ntrn),
    )
    addPriceAlias(
      mapped,
      "whale",
      normalizeExternalPrice(data.uwhale ?? data.whale),
    )
    addPriceAlias(mapped, "run", normalizeExternalPrice(data.urun ?? data.run))
    addPriceAlias(mapped, "eth", normalizeExternalPrice(data.weth ?? data.eth))
    addPriceAlias(mapped, "btc", normalizeExternalPrice(data.wbtc ?? data.btc))

    const dgnPrice = normalizeExternalPrice(
      data.udgn ?? data.dgn ?? data.dungeon,
    )
    addPriceAlias(mapped, "dgn", dgnPrice)
    addPriceAlias(mapped, "DGN", dgnPrice)
    addPriceAlias(mapped, "udgn", dgnPrice)
    addPriceAlias(mapped, "dungeon", dgnPrice)
    addPriceAlias(mapped, "Dungeon", dgnPrice)
    addPriceAlias(mapped, "dungeon-1:udgn", dgnPrice)

    return mapped
  } catch (error) {
    console.warn("Failed to load backend CoinMarketCap prices", error)
    return {}
  }
}

const queryFiatPrice = async (currencyId: string) => {
  if (currencyId === "USD") return 1

  try {
    const response = await axios.get<Record<string, { rate?: number }>>(
      "http://localhost:3001/api/fiat",
      {
        timeout: 10000,
      },
    )

    const data = response?.data

    return data?.[currencyId]?.rate ?? 1
  } catch (error) {
    console.warn(`Failed to load fiat conversion for ${currencyId}`, error)
    return 1
  }
}

export const useExchangeRates = () => {
  const currency = useCurrency()

  return useQuery(
    [queryKey.coingecko.exchangeRates, currency],
    async () => {
      const [stationAliases, cmcPrices, fiatPrice] = await Promise.all([
        queryStationAliases(),
        queryCMCPrices(),
        queryFiatPrice(currency.id),
      ])

      const mergedPrices: Record<string, ExternalPrice> = {
        ...cmcPrices,
      }

      const priceObject: PriceObject = {}

      Object.entries(mergedPrices).forEach(([key, value]) => {
        priceObject[key] = {
          price: Number(value?.usd ?? 0) * fiatPrice,
          change: Number(value?.change24h ?? 0),
        }
      })

      const luncPrice = (mergedPrices.lunc?.usd ?? 0) * fiatPrice
      const luncChange = mergedPrices.lunc?.change24h ?? 0

      const luna2Price = (mergedPrices.luna2?.usd ?? 0) * fiatPrice
      const luna2Change = mergedPrices.luna2?.change24h ?? 0

      const ustcPrice = (mergedPrices.ustc?.usd ?? 0) * fiatPrice
      const ustcChange = mergedPrices.ustc?.change24h ?? 0

      const dgnUsd = mergedPrices.dgn?.usd ?? mergedPrices.udgn?.usd ?? 0
      const dgnChange =
        mergedPrices.dgn?.change24h ?? mergedPrices.udgn?.change24h ?? 0

      priceObject["uluna:classic"] = {
        price: luncPrice,
        change: luncChange,
      }

      priceObject["uluna:phoenix"] = {
        price: luna2Price,
        change: luna2Change,
      }

      priceObject.lunc = {
        price: luncPrice,
        change: luncChange,
      }

      priceObject.luna2 = {
        price: luna2Price,
        change: luna2Change,
      }

      priceObject.uusd = {
        price: ustcPrice,
        change: ustcChange,
      }

      priceObject.ustc = {
        price: ustcPrice,
        change: ustcChange,
      }

      priceObject.dgn = {
        price: dgnUsd * fiatPrice,
        change: dgnChange,
      }

      priceObject.DGN = {
        price: dgnUsd * fiatPrice,
        change: dgnChange,
      }

      priceObject.udgn = {
        price: dgnUsd * fiatPrice,
        change: dgnChange,
      }

      priceObject["dungeon-1:udgn"] = {
        price: dgnUsd * fiatPrice,
        change: dgnChange,
      }

      if (mergedPrices.uusdc) {
        priceObject.uusdc = {
          price: (mergedPrices.uusdc.usd ?? 0) * fiatPrice,
          change: mergedPrices.uusdc.change24h ?? 0,
        }
      }

      if (mergedPrices.uusdt) {
        priceObject.uusdt = {
          price: (mergedPrices.uusdt.usd ?? 0) * fiatPrice,
          change: mergedPrices.uusdt.change24h ?? 0,
        }
      }

      Object.entries(AXELAR_TOKENS).forEach(([key, value]) => {
        if (priceObject[value] && !priceObject[key]) {
          priceObject[key] = {
            ...priceObject[value],
          }
        }
      })

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

export type CalcValue = (params: CoinData) => number | undefined

export const useMemoizedCalcValue = () => {
  const { data: memoizedPrices } = useExchangeRates()

  return useCallback<CalcValue>(
    ({ amount, denom, chain }) => {
      if (!memoizedPrices) return

      const chainSpecificKey =
        denom === "uluna" && chain
          ? chain === "columbus-5"
            ? "uluna:classic"
            : chain === "phoenix-1" || chain === "pisco-1"
              ? "uluna:phoenix"
              : denom
          : `${chain}:${denom}`

      return (
        Number(amount) *
        Number(
          memoizedPrices[chainSpecificKey]?.price ??
            memoizedPrices[denom]?.price ??
            0,
        )
      )
    },
    [memoizedPrices],
  )
}
