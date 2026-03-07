import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import axios from "axios"
import { useQuery } from "react-query"

const useCommithash = (enabled: boolean) =>
  useQuery(
    ["commit_hash"],
    async () => {
      try {
        const response = await axios.get("/commit_hash")
        return response?.data ?? ""
      } catch (error) {
        console.warn("commit_hash fetch failed:", error)
        return ""
      }
    },
    {
      enabled,
      retry: false,
      refetchOnWindowFocus: false,
    },
  )

export default function UpdateNotification() {
  const old_commit_hash = useRef<string | null>(null)
  const { t } = useTranslation()
  const [showNotification, setShownotification] = useState<boolean>(false)
  const { data: commit_hash } = useCommithash(showNotification)

  if (!commit_hash) return null

  if (old_commit_hash.current === null) {
    old_commit_hash.current = commit_hash
    return null
  }

  if (old_commit_hash.current !== commit_hash && !showNotification) {
    setShownotification(true)
  }

  if (!showNotification) return null

  return <div>{t("A new version is available. Please refresh the page.")}</div>
}
