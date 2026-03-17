import axios from "axios"
import { ASSETS, STATION_ASSETS } from "config/constants"
import { WhitelistProvider, WhitelistData } from "data/queries/chains"
import { PropsWithChildren, useEffect, useState } from "react"

const InitChains = ({ children }: PropsWithChildren<{}>) => {
  const [whitelist, setWhitelist] = useState<WhitelistData["whitelist"]>({})
  const [ibcDenoms, setIbcDenoms] = useState<WhitelistData["ibcDenoms"]>({})
  const [legacyWhitelist, setLegacyWhitelist] = useState<
    WhitelistData["legacyWhitelist"]
  >({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [denomsRes, ibcRes, legacyRes] = await Promise.allSettled([
          axios.get("/denoms.json", { baseURL: STATION_ASSETS }),
          axios.get("/ibc_tokens.json", { baseURL: STATION_ASSETS }),
          axios.get("/station/coins.json", { baseURL: ASSETS }),
        ])

        if (!mounted) return

        if (denomsRes.status === "fulfilled") {
          setWhitelist(denomsRes.value?.data ?? {})
        } else {
          console.error("Failed to load denoms.json", denomsRes.reason)
          setWhitelist({})
        }

        if (ibcRes.status === "fulfilled") {
          setIbcDenoms(ibcRes.value?.data ?? {})
        } else {
          console.error("Failed to load ibc_tokens.json", ibcRes.reason)
          setIbcDenoms({})
        }

        if (legacyRes.status === "fulfilled") {
          setLegacyWhitelist(legacyRes.value?.data ?? {})
        } else {
          console.error("Failed to load station/coins.json", legacyRes.reason)
          setLegacyWhitelist({})
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) return null

  return (
    <WhitelistProvider value={{ whitelist, ibcDenoms, legacyWhitelist }}>
      {children}
    </WhitelistProvider>
  )
}

export default InitChains
