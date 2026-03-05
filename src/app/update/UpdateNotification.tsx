// src/app/update/UpdateNotification.tsx

import { RefetchOptions } from "data/query"
import { useQuery } from "react-query"
import styles from "./UpdateNotification.module.scss"
import { useTranslation } from "react-i18next"
import axios from "axios"
import { useEffect, useRef, useState } from "react"

const isDev =
  typeof process !== "undefined" && process.env?.NODE_ENV === "development"

const useCommithash = (disabled: boolean) => {
  return useQuery(
    ["commit_hash"],
    async () => {
      try {
        // commit_hash file is typically created at build time (public/commit_hash)
        const res = await axios.get("/commit_hash", {
          timeout: 5_000,
          // avoid cached stale in prod when checking for updates
          headers: { "Cache-Control": "no-cache" },
        })
        return (res?.data ?? "").toString().trim()
      } catch (e: any) {
        const status = e?.response?.status

        // In dev (or if not configured), commit_hash file may not exist.
        // Treat as "not available" instead of throwing / spamming console.
        if (status === 404) return null

        // Any other failure: also treat as unavailable
        return null
      }
    },
    {
      ...RefetchOptions.DEFAULT,
      enabled: !disabled && !isDev, // disable completely in dev to stop spam
      retry: false,
      refetchOnWindowFocus: false,
    },
  )
}

export default function UpdateNotification() {
  const old_commit_hash = useRef<string | null>(null)
  const { t } = useTranslation()
  const [showNotification, setShownotification] = useState(false)

  const { data: commit_hash } = useCommithash(showNotification)

  useEffect(() => {
    if (showNotification) return

    // If commit_hash is not available (null), do nothing
    if (!commit_hash) return

    if (!old_commit_hash.current) old_commit_hash.current = commit_hash

    setShownotification(old_commit_hash.current !== commit_hash)
  }, [commit_hash, showNotification])

  if (!showNotification) return null

  return (
    <div className={styles.notification}>
      {t("There is a new version available")}
      <button onClick={() => window.location.reload()}>{t("Reload")}</button>
    </div>
  )
}
