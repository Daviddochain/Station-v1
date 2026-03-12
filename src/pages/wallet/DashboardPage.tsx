import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet"
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward"
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward"
import AddIcon from "@mui/icons-material/Add"
import { truncate } from "@terra-money/terra-utils"

import { useAddress, useInterchainAddresses } from "data/wallet"
import { useIsWalletConnected } from "auth/hooks/useAddress"
import { useWalletRoute, Path } from "./Wallet"
import ConnectWallet from "app/sections/ConnectWallet"

import styles from "./DashboardPage.module.scss"

const DashboardPage = () => {
  const { t } = useTranslation()
  const { setRoute } = useWalletRoute()

  const isConnected = useIsWalletConnected()
  const address = useAddress()
  const addresses = useInterchainAddresses()

  const addressCount = useMemo(() => {
    return Object.keys(addresses ?? {}).length
  }, [addresses])

  if (!isConnected) {
    return (
      <section className={styles.page}>
        <div className={styles.connectCard}>
          <AccountBalanceWalletIcon fontSize="large" />

          <h2>{t("Connect wallet")}</h2>

          <p>
            {t(
              "Connect your wallet to view portfolio value, balances, and wallet actions.",
            )}
          </p>

          <ConnectWallet />
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.mainCard}>
          <div className={styles.header}>
            <h2>{t("Portfolio value")}</h2>
            <span className={styles.address}>
              {truncate(address ?? "", [10, 8])}
            </span>
          </div>

          <div className={styles.value}>$0.00</div>

          <div className={styles.actions}>
            <button
              onClick={() =>
                setRoute({
                  path: Path.send,
                  previousPage: { path: Path.wallet },
                })
              }
            >
              <ArrowUpwardIcon />
              {t("Send")}
            </button>

            <button
              onClick={() =>
                setRoute({
                  path: Path.receive,
                  previousPage: { path: Path.wallet },
                })
              }
            >
              <ArrowDownwardIcon />
              {t("Receive")}
            </button>

            <button
              onClick={() =>
                setRoute({
                  path: Path.swap,
                  previousPage: { path: Path.wallet },
                })
              }
            >
              <AddIcon />
              {t("Buy")}
            </button>
          </div>
        </div>

        <div className={styles.sideCard}>
          <h3>{t("Wallet overview")}</h3>

          <div className={styles.stat}>
            <span>{t("Address")}</span>
            <strong>{truncate(address ?? "", [10, 8])}</strong>
          </div>

          <div className={styles.stat}>
            <span>{t("Known addresses")}</span>
            <strong>{addressCount}</strong>
          </div>

          <div className={styles.stat}>
            <span>{t("Status")}</span>
            <strong>{t("Connected")}</strong>
          </div>
        </div>
      </div>

      <div className={styles.assets}>
        <h3>{t("Assets")}</h3>

        <div className={styles.empty}>
          {t("Token balances will appear here")}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
