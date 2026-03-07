import { useQueries, useQuery } from "react-query"
import { queryKey } from "../query"

interface NetworkItem {
  chainID: string
  lcd: string
}

interface LCDValidationResult {
  valid: boolean
  url: string
}

const isBrowser = typeof window !== "undefined"

const parseURL = (value?: string) => {
  if (!value) return null

  try {
    return new URL(value)
  } catch {
    return null
  }
}

const isLocalHost = (hostname: string) => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  )
}

const canBrowserValidateLCD = (lcd?: string) => {
  const target = parseURL(lcd)

  if (!target) return false
  if (!isBrowser) return true

  const current = parseURL(window.location.origin)
  if (!current) return false

  if (target.origin === current.origin) return true
  if (isLocalHost(target.hostname) && isLocalHost(current.hostname)) return true

  return false
}

const validateNetworkRequest = async (network?: NetworkItem) => {
  if (!network?.lcd || !network?.chainID) return null

  /*
   * Public LCDs often block browser CORS even when the endpoint itself is fine.
   * So browser-side startup validation creates false negatives and console spam.
   * Until LCD traffic is moved behind a proxy/backend, treat configured networks
   * as available instead of probing them from the browser here.
   */
  return network.chainID
}

export const useValidNetwork = (network?: NetworkItem) => {
  return useQuery(
    [queryKey.tendermint.nodeInfo, network?.chainID, network?.lcd],
    () => validateNetworkRequest(network),
    {
      enabled: !!network?.lcd && !!network?.chainID,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  )
}

export const useValidNetworks = (networks: NetworkItem[] = []) => {
  return useQueries(
    networks.map((network) => ({
      queryKey: [queryKey.tendermint.nodeInfo, network?.chainID, network?.lcd],
      queryFn: () => validateNetworkRequest(network),
      enabled: !!network?.lcd && !!network?.chainID,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    })),
  )
}

export const useValidateLCD = (lcd?: string) => {
  return useQuery<LCDValidationResult>(
    [queryKey.tendermint.nodeInfo, "custom-lcd", lcd],
    async () => {
      if (!lcd) {
        return {
          valid: false,
          url: "",
        }
      }

      if (!canBrowserValidateLCD(lcd)) {
        return {
          valid: true,
          url: lcd,
        }
      }

      try {
        const response = await fetch(
          `${lcd}/cosmos/base/tendermint/v1beta1/node_info`,
          {
            method: "GET",
          },
        )

        return {
          valid: response.ok,
          url: lcd,
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn("Custom LCD validation failed:", {
            lcd,
            message: error.message,
          })
        } else {
          console.warn("Custom LCD validation failed:", {
            lcd,
            message: String(error),
          })
        }

        return {
          valid: false,
          url: lcd,
        }
      }
    },
    {
      enabled: !!lcd,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      cacheTime: 5 * 60 * 1000,
    },
  )
}
