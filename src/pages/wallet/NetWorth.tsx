// src/pages/wallet/NetWorth.tsx

import { useMemo } from "react"
import classNames from "classnames"
import { capitalize } from "@mui/material"
import { useTranslation } from "react-i18next"

import { ReactComponent as ReceiveIcon } from "styles/images/icons/Receive_v2.svg"
import { ReactComponent as SendIcon } from "styles/images/icons/Send_v2.svg"
import { ReactComponent as AddIcon } from "styles/images/icons/Buy_v2.svg"

import { useChainID, useNetwork, useNetworkName } from "data/wallet"
import { useBankBalance, useIsWalletEmpty } from "data/queries/bank"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { useExchangeRates } from "data/queries/coingecko"
import { useCurrency } from "data/settings/Currency"
import { useNativeDenoms } from "data/token"

import { ModalButton } from "components/feedback"
import { TooltipIcon } from "components/display"
import { Button } from "components/general"
import { Read } from "components/token"

import { Path, useWalletRoute } from "./Wallet"
import NetWorthTooltip from "./NetWorthTooltip"
import FiatRampModal from "./FiatRampModal"

import styles from "./NetWorth.module.scss"

const cx = classNames.bind(styles)

const NetWorth = () => {
  const { t } = useTranslation()
  const currency = useCurrency()
  const coins = useBankBalance()
  const { data: prices } = useExchangeRates()
  const readNativeDenom = useNativeDenoms()
  const { setRoute, route } = useWalletRoute()
  const addresses = useInterchainAddresses()
  const networkName = useNetworkName()
  const isWalletEmpty = useIsWalletEmpty()

  const networks = useNetwork()
  const chainID = useChainID()

  const availableGasDenoms = useMemo(() => {
    const gasPrices = networks?.[chainID]?.gasPrices
    return gasPrices ? Object.keys(gasPrices) : []
  }, [chainID, networks])

  const sendButtonDisabled = !!isWalletEmpty && availableGasDenoms.length > 0

  const coinsValue =
    coins?.reduce((acc, { amount, denom, chain }) => {
      const nativeDenom = readNativeDenom(denom, chain)

      const token = nativeDenom?.token ?? denom
      const decimals = nativeDenom?.decimals ?? 6
      const symbol = nativeDenom?.symbol ?? denom
      const parsedAmount = Number(amount ?? 0)

      const resolvedPrice =
        symbol === "LUNC"
          ? (prices?.["uluna:classic"]?.price ?? prices?.lunc?.price ?? 0)
          : symbol === "LUNA"
            ? (prices?.["uluna:phoenix"]?.price ?? prices?.luna2?.price ?? 0)
            : symbol?.endsWith("...")
              ? 0
              : (prices?.[`${chain}:${denom}`]?.price ??
                prices?.[denom]?.price ??
                prices?.[token]?.price ??
                prices?.[symbol?.toLowerCase?.() ?? ""]?.price ??
                prices?.[`${denom}:classic`]?.price ??
                prices?.[`${denom}:phoenix`]?.price ??
                0)

      return acc + (parsedAmount * resolvedPrice) / Math.pow(10, decimals)
    }, 0) ?? 0

  const displayFixed =
    coinsValue > 0 && coinsValue < 0.01
      ? 8
      : coinsValue >= 0.01 && coinsValue < 1
        ? 4
        : 2

  return (
    <article className={styles.networth}>
      <TooltipIcon content={<NetWorthTooltip />} placement="bottom">
        <p>{capitalize(t("portfolio value"))}</p>
      </TooltipIcon>

      <h1>
        {currency.symbol}{" "}
        <Read
          className={styles.amount}
          amount={coinsValue}
          decimals={0}
          fixed={displayFixed}
          denom=""
        />
      </h1>

      <div className={styles.networth__buttons}>
        <div className={styles.button__wrapper}>
          <Button
            color="primary"
            className={styles.wallet_primary}
            disabled={sendButtonDisabled}
            onClick={() =>
              setRoute({
                path: Path.send,
                previousPage: route,
              })
            }
          >
            <SendIcon className={cx(styles.icon, styles.send)} />
          </Button>
          <h3>{capitalize(t("send"))}</h3>
        </div>

        <div className={styles.button__wrapper}>
          <Button
            className={styles.wallet_default}
            onClick={() =>
              setRoute({
                path: Path.receive,
                previousPage: route,
              })
            }
          >
            <ReceiveIcon className={cx(styles.icon, styles.receive)} />
          </Button>
          <h3>{capitalize(t("receive"))}</h3>
        </div>

        {addresses && networkName === "mainnet" && (
          <div className={styles.button__wrapper}>
            <ModalButton
              minimal
              renderButton={(open) => (
                <Button className={styles.wallet_default} onClick={open}>
                  <AddIcon className={styles.icon} />
                </Button>
              )}
            >
              <FiatRampModal />
            </ModalButton>
            <h2>{t(capitalize("buy"))}</h2>
          </div>
        )}
      </div>
    </article>
  )
}

export default NetWorth
