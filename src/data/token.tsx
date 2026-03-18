import { ReactNode } from "react"
import { isDenomIBC } from "@terra-money/terra-utils"
import { readDenom, truncate } from "@terra-money/terra-utils"
import { AccAddress } from "@terra-money/feather.js"
import { ASSETS } from "config/constants"
import { useTokenInfoCW20 } from "./queries/wasm"
import { useCustomTokensCW20 } from "./settings/CustomTokens"
import {
  useGammTokens,
  GAMM_TOKEN_DECIMALS,
  OSMO_ICON,
} from "./external/osmosis"
import { useCW20Whitelist, useIBCWhitelist } from "./Terra/TerraAssets"
import { useWhitelist } from "./queries/chains"
import { useNetworkName, useNetwork } from "./wallet"
import { getChainIDFromAddress } from "utils/bech32"

export const DEFAULT_NATIVE_DECIMALS = 6

export const useTokenItem = (
  token: Token,
  chainID?: string,
): TokenItem | undefined => {
  const readNativeDenom = useNativeDenoms()

  const matchToken = (item: TokenItem) => item.token === token

  const { list } = useCustomTokensCW20()
  const customTokenItem = list.find(matchToken)

  const cw20WhitelistResult = useCW20Whitelist(!!customTokenItem)
  const { data: cw20Whitelist = {} } = cw20WhitelistResult
  const listedCW20TokenItem = Object.values(cw20Whitelist ?? {}).find(
    matchToken,
  )

  const shouldQueryCW20 = cw20WhitelistResult.isSuccess && !listedCW20TokenItem
  const tokenInfoResult = useTokenInfoCW20(token, shouldQueryCW20)
  const { data: tokenInfo } = tokenInfoResult
  const tokenInfoItem = tokenInfo ? { token, ...tokenInfo } : undefined

  const { data: ibcWhitelist = {} } = useIBCWhitelist()
  const listedIBCTokenItem = ibcWhitelist[token.replace("ibc/", "")]

  if (AccAddress.validate(token)) {
    return customTokenItem ?? listedCW20TokenItem ?? tokenInfoItem
  }

  if (isDenomIBC(token)) {
    const item = {
      ...listedIBCTokenItem,
      denom: token,
      base_denom: listedIBCTokenItem?.base_denom,
    }

    return readIBCDenom(item)
  }

  return readNativeDenom(token, chainID)
}

interface Props {
  token: Token
  chainID?: string
  children: (token: TokenItem) => ReactNode
}

export const WithTokenItem = ({ token, chainID, children }: Props) => {
  const readNativeDenom = useNativeDenoms()
  return <>{children(readNativeDenom(token, chainID))}</>
}

export const getIcon = (path: string) => `${ASSETS}/icon/svg/${path}`

export enum TokenType {
  IBC = "ibc",
  GAMM = "gamm",
  FACTORY = "factory",
  STRIDE = "stride",
}

export const useNativeDenoms = () => {
  const { whitelist, ibcDenoms } = useWhitelist()
  const { list: cw20 } = useCustomTokensCW20()
  const networkName = useNetworkName()
  const networks = useNetwork()
  const gammTokens = useGammTokens()

  function readNativeDenom(
    denom = "",
    chainID?: string,
  ): TokenItem & { isNonWhitelisted?: boolean } {
    let decimals = DEFAULT_NATIVE_DECIMALS
    let tokenType = ""

    if (denom.startsWith("ibc/")) {
      tokenType = TokenType.IBC
    } else if (denom.startsWith("factory/")) {
      tokenType = TokenType.FACTORY
    } else if (denom.startsWith("gamm/")) {
      tokenType = TokenType.GAMM
      decimals = GAMM_TOKEN_DECIMALS
    } else if (
      denom.startsWith("stu") &&
      (!chainID || chainID === "stride-1")
    ) {
      tokenType = TokenType.STRIDE
    }

    let fixedDenom = ""
    switch (tokenType) {
      case TokenType.IBC:
        fixedDenom = `${readDenom(denom).substring(0, 5)}...`
        break

      case TokenType.GAMM:
        fixedDenom = gammTokens.get(denom) ?? readDenom(denom)
        break

      case TokenType.FACTORY:
        const factoryParts = denom.split(/[/:]/)
        let tokenAddress = ""
        if (factoryParts.length >= 2) {
          tokenAddress = factoryParts.slice(2).join(" ")
        }
        fixedDenom = tokenAddress
        break

      case TokenType.STRIDE:
        fixedDenom = `st${denom.replace("stu", "").toUpperCase()}`
        break

      default:
        fixedDenom = readDenom(denom) || denom
    }

    let factoryIcon
    if (tokenType === TokenType.FACTORY) {
      const tokenAddress = denom.split(/[/:]/)[1]
      const derivedChainID = getChainIDFromAddress(tokenAddress, networks)
      if (derivedChainID) {
        factoryIcon = networks[derivedChainID]?.icon
      }
    }

    if (tokenType === TokenType.GAMM) {
      factoryIcon = OSMO_ICON
    }

    // whitelist native
    if (chainID) {
      const tokenID = `${chainID}:${denom}`
      if (whitelist[networkName]?.[tokenID])
        return whitelist[networkName][tokenID]
    } else {
      const tokenDetails = Object.values(whitelist[networkName] ?? {}).find(
        ({ token }) => token === denom,
      )
      if (tokenDetails) return tokenDetails
    }

    // ibc
    let ibcToken = chainID
      ? ibcDenoms[networkName]?.[`${chainID}:${denom}`]
      : Object.entries(ibcDenoms[networkName] ?? {}).find(
          ([k]) => k.split(":")[1] === denom,
        )?.[1]

    if (
      ibcToken &&
      whitelist[networkName][ibcToken?.token] &&
      (!chainID || ibcToken?.chainID === chainID)
    ) {
      return {
        ...whitelist[networkName][ibcToken.token],
        type: tokenType,
        // @ts-expect-error
        chains: [ibcToken.chainID],
      }
    }

    // Terra special handling
    if (denom === "uluna") {
      if (chainID === "columbus-5" || (!chainID && networkName === "classic")) {
        return {
          token: denom,
          symbol: "LUNC",
          name: "Luna Classic",
          icon: "https://assets.terra.dev/icon/svg/LUNC.svg",
          decimals: 6,
          isNonWhitelisted: false,
        }
      } else if (chainID === "phoenix-1" || chainID === "pisco-1") {
        return {
          token: denom,
          symbol: "LUNA",
          name: "Luna",
          icon: "https://assets.terra.dev/icon/svg/Luna.svg",
          decimals: 6,
          isNonWhitelisted: false,
        }
      }
    }

    const CHAIN_ICON =
      networks[chainID ?? ""]?.icon ||
      "https://assets.terra.dev/icon/svg/Terra.svg"

    return (
      cw20.find(({ token }) => denom === token) ?? {
        token: denom,
        symbol: fixedDenom,
        name: fixedDenom,
        type: tokenType,
        icon:
          (tokenType === TokenType.IBC
            ? "https://assets.terra.dev/icon/svg/IBC.svg"
            : tokenType === TokenType.STRIDE
              ? "https://station-assets.terra.dev/img/chains/Stride.png"
              : (tokenType === TokenType.FACTORY ||
                  tokenType === TokenType.GAMM) &&
                factoryIcon) || CHAIN_ICON,
        decimals,
        isNonWhitelisted: true,
      }
    )
  }

  return readNativeDenom
}

export const readIBCDenom = (item: IBCTokenItem): TokenItem => {
  const { denom, base_denom } = item
  const symbol =
    item.symbol ?? ((base_denom && readDenom(base_denom)) || base_denom)
  const path = symbol ? `ibc/${symbol}.svg` : "IBC.svg"

  return {
    token: denom,
    symbol: symbol ?? truncate(denom),
    icon: getIcon(path),
    decimals: item.decimals ?? 6,
  }
}
