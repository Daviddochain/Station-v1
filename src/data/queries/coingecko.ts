import { useCallback } from "react"
import { useQuery } from "react-query"
import { queryKey, RefetchOptions } from "../query"
import { STATION_ASSETS, ASSETS } from "config/constants"
import axios from "axios"
import { useCurrency } from "data/settings/Currency"
import { useChainID } from "data/wallet"

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
  return {}
}

const queryCMCPrices = async (): Promise<Record<string, ExternalPrice>> => {
  try {
    const response = await axios.get<
      Record<string, { price?: number; change?: number }>
    >("http://localhost:3001/api/prices", {
      timeout: 10000,
    })

    const data = response?.data

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Invalid backend price response format", data)
      return {}
    }

    const toExternalPrice = (entry?: {
      price?: number
      change?: number
    }): ExternalPrice => ({
      usd: entry?.price ?? 0,
      change24h: entry?.change ?? 0,
    })

    return {
      lunc: toExternalPrice(
        data["uluna:classic"] ?? data.uluna_classic ?? data.uluna ?? data.lunc,
      ),
      luna2: toExternalPrice(data["uluna:phoenix"] ?? data.luna2 ?? data.luna),
      ustc: toExternalPrice(data.uusd ?? data.ustc),
      uusdc: toExternalPrice(data.uusdc ?? data.usdc),
      uusdt: toExternalPrice(data.uusdt ?? data.usdt),
      atom: toExternalPrice(data.uatom ?? data.atom),
      osmo: toExternalPrice(data.uosmo ?? data.osmo),
      juno: toExternalPrice(data.ujuno ?? data.juno),
      sei: toExternalPrice(data.usei ?? data.sei),
      inj: toExternalPrice(data.uinj ?? data.inj),
      akt: toExternalPrice(data.uakt ?? data.akt),
      scrt: toExternalPrice(data.uscrt ?? data.scrt),
      kuji: toExternalPrice(data.ukuji ?? data.kuji),
      stars: toExternalPrice(data.ustars ?? data.stars),
      dydx: toExternalPrice(data.udydx ?? data.dydx),
      ntrn: toExternalPrice(data.untrn ?? data.ntrn),
      whale: toExternalPrice(data.uwhale ?? data.whale),
      run: toExternalPrice(data.urun ?? data.run),
      eth: toExternalPrice(data.weth ?? data.eth),
      btc: toExternalPrice(data.wbtc ?? data.btc),
    }
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

const getUlunaPriceByChain = (
  chainID: string | undefined,
  prices: Record<string, ExternalPrice>,
) => {
  if (chainID === "columbus-5") {
    return prices.lunc ?? { usd: 0, change24h: 0 }
  }

  if (chainID === "phoenix-1") {
    return prices.luna2 ?? { usd: 0, change24h: 0 }
  }

  return prices.lunc ?? prices.luna2 ?? { usd: 0, change24h: 0 }
}

export const useExchangeRates = () => {
  const currency = useCurrency()
  const chainID = useChainID()

  return useQuery(
    [queryKey.coingecko.exchangeRates, currency, chainID],
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
        ...cmcPrices,
      }

      const activeUluna = getUlunaPriceByChain(chainID, mergedPrices)

      const luncPrice = (mergedPrices.lunc?.usd ?? 0) * fiatPrice
      const luncChange = mergedPrices.lunc?.change24h ?? 0

      const luna2Price = (mergedPrices.luna2?.usd ?? 0) * fiatPrice
      const luna2Change = mergedPrices.luna2?.change24h ?? 0

      const ustcPrice = (mergedPrices.ustc?.usd ?? 0) * fiatPrice
      const ustcChange = mergedPrices.ustc?.change24h ?? 0

      const activeUlunaPrice = (activeUluna.usd ?? 0) * fiatPrice
      const activeUlunaChange = activeUluna.change24h ?? 0

      const priceObject: PriceObject = {
        uluna: {
          price: activeUlunaPrice,
          change: activeUlunaChange,
        },
        "uluna:classic": {
          price: luncPrice,
          change: luncChange,
        },
        "uluna:phoenix": {
          price: luna2Price,
          change: luna2Change,
        },
        lunc: {
          price: luncPrice,
          change: luncChange,
        },
        luna2: {
          price: luna2Price,
          change: luna2Change,
        },
        uusd: {
          price: ustcPrice,
          change: ustcChange,
        },
        ustc: {
          price: ustcPrice,
          change: ustcChange,
        },
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
