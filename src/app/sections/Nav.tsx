import { useEffect, useMemo, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useRecoilState, useSetRecoilState } from "recoil"
import classNames from "classnames/bind"
import CloseIcon from "@mui/icons-material/Close"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"
import { mobileIsMenuOpenState } from "components/layout"
import { useNav } from "../routes"
import styles from "./Nav.module.scss"
import { useThemeFavicon, useTheme } from "data/settings/Theme"
import { isWalletBarOpen } from "pages/wallet/Wallet"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"
import { InterchainNetwork } from "types/network"
import { STATION_ASSETS } from "config/constants"

const cx = classNames.bind(styles)

const resolveIconSrc = (icon?: string) => {
  if (!icon) return ""

  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return icon
  }

  if (icon.startsWith("/")) {
    return `${STATION_ASSETS}${icon}`
  }

  return `${STATION_ASSETS}/${icon}`
}

const getCoinFallbackFromChainIcon = (icon?: string) => {
  if (!icon) return ""

  const filename = icon.split("/").pop()
  if (!filename) return ""

  const mappedNames: Record<string, string> = {
    "Archway.png": "Aarch.png",
    "Kujira.png": "Kuji.svg",
    "Migaloo.svg": "Whale.svg",
    "Osmosis.svg": "Osmo.svg",
    "TerraClassic.svg": "LunaClassic.svg",
  }

  const fallbackName = mappedNames[filename] || filename
  return `${window.location.origin}/img/coins/${fallbackName}`
}

type ChainIconProps = {
  chain: InterchainNetwork
}

const ChainIcon = ({ chain }: ChainIconProps) => {
  const primarySrc = resolveIconSrc(chain.icon)
  const fallbackSrc = getCoinFallbackFromChainIcon(chain.icon)

  const [src, setSrc] = useState(primarySrc)
  const [failedPrimary, setFailedPrimary] = useState(false)
  const [failedFallback, setFailedFallback] = useState(false)

  useEffect(() => {
    const nextPrimary = resolveIconSrc(chain.icon)
    setSrc(nextPrimary)
    setFailedPrimary(false)
    setFailedFallback(false)
  }, [chain.icon])

  if (!chain.icon || (failedPrimary && failedFallback)) {
    return <span className={styles.networkIconPlaceholder} />
  }

  return (
    <img
      src={src}
      alt={chain.name}
      className={styles.networkIcon}
      onError={() => {
        if (!failedPrimary && fallbackSrc && fallbackSrc !== src) {
          setSrc(fallbackSrc)
          setFailedPrimary(true)
          return
        }

        setFailedFallback(true)
      }}
    />
  )
}

const Nav = () => {
  useCloseMenuOnNavigate()

  const { menu } = useNav()
  const { networks } = useNetworks()
  const icon = useThemeFavicon()
  const [isOpen, setIsOpen] = useRecoilState(mobileIsMenuOpenState)
  const close = () => setIsOpen(false)
  const { name } = useTheme()
  const { selectedDisplayChain, changeSelectedDisplayChain } =
    useSelectedDisplayChain()

  const [openGroups, setOpenGroups] = useState({
    classic: true,
    mainnet: false,
    testnet: false,
    localterra: false,
  })

  const classicNetworks = useMemo(
    () => Object.values(networks?.classic ?? {}) as InterchainNetwork[],
    [networks],
  )

  const mainnetNetworks = useMemo(
    () => Object.values(networks?.mainnet ?? {}) as InterchainNetwork[],
    [networks],
  )

  const testnetNetworks = useMemo(
    () => Object.values(networks?.testnet ?? {}) as InterchainNetwork[],
    [networks],
  )

  const localterraNetworks = useMemo(
    () => Object.values(networks?.localterra ?? {}) as InterchainNetwork[],
    [networks],
  )

  const handleSelectChain = (chainID: string) => {
    changeSelectedDisplayChain(chainID)
    close()
  }

  const toggleGroup = (
    group: "classic" | "mainnet" | "testnet" | "localterra",
  ) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }))
  }

  const renderNetworkGroup = (
    key: "classic" | "mainnet" | "testnet" | "localterra",
    title: string,
    list: InterchainNetwork[] | undefined,
  ) => {
    if (!list?.length) return null

    const isGroupOpen = openGroups[key]

    return (
      <div className={styles.networkGroup}>
        <button
          type="button"
          className={styles.networkGroupHeader}
          onClick={() => toggleGroup(key)}
        >
          <span>{title}</span>
          {isGroupOpen ? (
            <KeyboardArrowDownIcon fontSize="small" />
          ) : (
            <KeyboardArrowRightIcon fontSize="small" />
          )}
        </button>

        {isGroupOpen && (
          <div className={styles.networkGroupList}>
            {list.map((chain) => (
              <button
                key={chain.chainID}
                type="button"
                onClick={() => handleSelectChain(chain.chainID)}
                className={cx(styles.item, styles.link, styles.networkLink, {
                  active: selectedDisplayChain === chain.chainID,
                })}
              >
                <ChainIcon chain={chain} />
                <span className={styles.networkName}>{chain.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className={styles.nav}>
      <header className={styles.header}>
        <div className={cx(styles.item, styles.logo)}>
          <img src={icon} alt="Station" />
          <strong className={styles.title}>Station</strong>
        </div>
        {isOpen && (
          <button className={styles.toggle} onClick={close}>
            <CloseIcon />
          </button>
        )}
      </header>

      <div className={styles.menuSection}>
        {menu.map(({ path, title, icon }) => (
          <NavLink
            to={path}
            className={({ isActive }) =>
              cx(styles.item, styles.link, { active: isActive })
            }
            key={path}
          >
            {icon}
            {title}
          </NavLink>
        ))}
      </div>

      <div className={styles.networksSection}>
        <div className={styles.networksTitle}>Networks</div>

        {renderNetworkGroup("classic", "Terra Classic", classicNetworks)}
        {renderNetworkGroup("mainnet", "Mainnets", mainnetNetworks)}
        {renderNetworkGroup("testnet", "Testnets", testnetNetworks)}
        {renderNetworkGroup("localterra", "LocalTerra", localterraNetworks)}
      </div>

      {name === "blossom" && (
        <>
          <div
            className={`${styles.background_blur_blossom} ${
              isOpen ? styles.open : ""
            }`}
          />
          <div
            className={`${styles.background_blur_blossom2} ${
              isOpen ? styles.open : ""
            }`}
          />
          <div
            className={`${styles.background_blur_blossom3} ${
              isOpen ? styles.open : ""
            }`}
          />
        </>
      )}
    </nav>
  )
}

export default Nav

/* hooks */
const useCloseMenuOnNavigate = () => {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useRecoilState(mobileIsMenuOpenState)
  const setIsWalletOpen = useSetRecoilState(isWalletBarOpen)

  useEffect(() => {
    if (isOpen) {
      setIsWalletOpen(false)
    }
    setIsOpen(false)
  }, [pathname, setIsOpen, setIsWalletOpen]) // eslint-disable-line react-hooks/exhaustive-deps
}
