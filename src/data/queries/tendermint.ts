// src/data/queries/tendermint.ts

import { useQueries, useQuery } from "react-query"
import axios from "axios"
import { queryKey, RefetchOptions } from "../query"
import { useNetworks } from "app/InitNetworks"
import { VALIDATION_TIMEOUT } from "config/constants"
import { randomAddress } from "utils/bech32"

/**
 * Browser reality:
 * - If an LCD doesn't allow CORS, axios/fetch will fail no matter what.
 * - We can only "validate" LCDs from the browser if they are:
 *    a) same-origin (served by our dev/prod host), OR
 *    b) already relative (e.g. "/lcd/...") meaning your app/server is proxying it.
 *
 * Anything else should be treated as "unverifiable in-browser" to avoid console spam.
 */
const canCallFromBrowser = (lcd?: string) => {
  if (!lcd) return false
  if (lcd.startsWith("/")) return true

  try {
    const u = new URL(lcd)
    // Same-origin requests do not require CORS
    return typeof window !== "undefined" && u.origin === window.location.origin
  } catch {
    return false
  }
}

export const useLocalNodeInfo = (chainID: string) => {
  const { networks } = useNetworks()

  return useQuery(
    [queryKey.tendermint.nodeInfo, chainID],
    async () => {
      const baseURL = networks?.[chainID]?.[chainID]?.lcd
      if (!baseURL) return null

      try {
        const res = await axios.get(
          "cosmos/base/tendermint/v1beta1/node_info",
          {
            baseURL,
            timeout: 10_000,
          },
        )
        return res?.data ?? null
      } catch {
        return null
      }
    },
    { ...RefetchOptions.INFINITY, enabled: chainID === "localterra" },
  )
}

export const useValidateLCD = (
  lcd?: string,
  chainID?: string,
  enabled?: boolean,
) => {
  return useQuery(
    [queryKey.tendermint.nodeInfo, "validateLCD", lcd, chainID],
    async () => {
      if (!lcd || !chainID) return

      // basic URL validation
      try {
        // allow relative (proxy/same-origin)
        if (!lcd.startsWith("/")) {
          const url = new URL(lcd)
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            return "The LCD must be an HTTP or HTTPS URL"
          }
        }
      } catch {
        return "Invalid URL provided"
      }

      // If we can't call it from the browser, don't even try (prevents CORS spam)
      if (!canCallFromBrowser(lcd)) {
        return "This LCD cannot be validated from the browser due to CORS. Use a same-origin/proxied LCD URL."
      }

      // node_info validation (safe to attempt only if browser-callable)
      try {
        const res = await axios.get(
          "/cosmos/base/tendermint/v1beta1/node_info",
          {
            baseURL: lcd,
            timeout: 3_000,
          },
        )

        const data = res?.data
        if (!data) return "Unable to connect to the LCD"

        const nodeChain =
          "default_node_info" in data
            ? (data.default_node_info.network as string)
            : (data.node_info.network as string)

        if (nodeChain !== chainID) {
          return `Invalid chain. Expected ${chainID}, got ${nodeChain}.`
        }

        // valid -> return undefined
      } catch {
        return "Unable to connect to the LCD"
      }
    },
    {
      ...RefetchOptions.INFINITY,
      enabled,
      retry: false,
      refetchOnWindowFocus: false,
    },
  )
}

interface Network {
  chainID: string
  prefix: string
  lcd: string
}

export const useValidNetworks = (networks: Network[]) => {
  return useQueries(
    networks.map(({ chainID, prefix, lcd }) => {
      return {
        queryKey: [queryKey.tendermint.nodeInfo, chainID, lcd],
        queryFn: async () => {
          // Terra-family chains can pass without doing a bank balances check
          if (prefix === "terra") return chainID

          // If the LCD is not browser-callable (CORS), skip validation.
          // Returning null means: "unknown/unverified" (prevents console spam).
          if (!canCallFromBrowser(lcd)) return null

          // Bank balances check on a random valid bech32 address.
          // Accept 200 (balances array) OR 404 (unknown account) as "LCD reachable".
          try {
            const res = await axios.get(
              `/cosmos/bank/v1beta1/balances/${randomAddress(prefix)}`,
              {
                baseURL: lcd,
                timeout: VALIDATION_TIMEOUT,
              },
            )

            const data = res?.data
            if (data && Array.isArray(data.balances)) return chainID

            return null
          } catch (e: any) {
            const status = e?.response?.status
            if (status === 404) return chainID
            return null
          }
        },
        ...RefetchOptions.INFINITY,
        retry: false,
        refetchOnWindowFocus: false,
      }
    }),
  )
}
