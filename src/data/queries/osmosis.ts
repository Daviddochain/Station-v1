import { useQuery } from "react-query"
import axios from "axios"
import { RefetchOptions } from "../query"

const IMPERATOR_POOLS_URL =
  "https://api-osmosis.imperator.co/pools/v2/all?low_liquidity=true"

export const useOsmosisPools = () => {
  return useQuery(
    ["osmosis:pools"],
    async () => {
      try {
        const res = await axios.get(IMPERATOR_POOLS_URL, { timeout: 8000 })
        const data = res?.data

        if (!data) return []
        if (Array.isArray(data)) return data
        if (Array.isArray((data as any)?.pools)) return (data as any).pools

        return []
      } catch {
        return []
      }
    },
    {
      ...RefetchOptions.INFINITY,
      retry: false,
      refetchOnWindowFocus: false,
    },
  )
}
