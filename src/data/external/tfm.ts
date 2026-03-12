import axios from "axios"
import { useQuery } from "react-query"
import { RefetchOptions } from "data/query"

export const TFM_BASE_URL = "https://api-terra2.tfm.com"
export const TFM_ROUTER = "tfm"

export interface TFMTokenItem {
  denom?: string
  symbol?: string
  name?: string
  decimals?: number
  chainId?: string
  image?: string
  tokenUri?: string
  price?: number
}

export interface TFMRouteResult {
  amountOut?: string
  routes?: unknown[]
}

export interface TFMSwapResult {
  tx?: unknown
  error?: string
}

export const queryTFMTokens = async (): Promise<TFMTokenItem[]> => {
  return []
}

export const useTFMTokens = () => {
  return useQuery(["tfm", "tokens"], queryTFMTokens, {
    ...RefetchOptions.DEFAULT,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export const queryTFMRoute = async (
  params: Record<string, string | number | boolean | undefined>,
): Promise<TFMRouteResult | null> => {
  try {
    const response = await axios.get("/route", {
      baseURL: TFM_BASE_URL,
      params,
      timeout: 10000,
    })

    const data = response?.data

    if (!data || typeof data !== "object") {
      console.warn("Invalid TFM route response format", data)
      return null
    }

    if (data?.data && typeof data.data === "object") {
      return data.data as TFMRouteResult
    }

    return data as TFMRouteResult
  } catch (error) {
    console.warn("Failed to load TFM route", error)
    return null
  }
}

export const queryTFMSwap = async (
  params: Record<string, string | number | boolean | undefined>,
): Promise<TFMSwapResult | null> => {
  try {
    const response = await axios.get("/swap", {
      baseURL: TFM_BASE_URL,
      params,
      timeout: 10000,
    })

    const data = response?.data

    if (!data || typeof data !== "object") {
      console.warn("Invalid TFM swap response format", data)
      return null
    }

    if (data?.data && typeof data.data === "object") {
      return data.data as TFMSwapResult
    }

    return data as TFMSwapResult
  } catch (error) {
    console.warn("Failed to load TFM swap", error)
    return null
  }
}
