import { atom } from "recoil"
import { getWallet } from "../scripts/keystore"

export const walletState = atom({
  key: "interchain-wallet",
  default: getWallet(),
})
