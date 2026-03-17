import { AccAddress, ValAddress } from "@terra-money/feather.js"
import { bech32 } from "bech32"

export function getChainIDFromAddress(
  address: any,
  chains: Record<
    string,
    {
      chainID: string
      prefix: string
    }
  >,
) {
  const isAccAddress = AccAddress.validate(address)
  const isValAddress = ValAddress.validate(address)

  if (!isAccAddress && !isValAddress) return undefined

  const addPrefix = bech32.decode(address).prefix

  return Object.values(chains ?? {}).find(
    ({ prefix }) => prefix === addPrefix || `${prefix}valoper` === addPrefix,
  )?.chainID
}

export function addressFromWords(words: string, prefix = "terra") {
  return bech32.encode(prefix, bech32.toWords(Buffer.from(words, "hex")))
}

export function wordsFromAddress(address: string) {
  return Buffer.from(bech32.fromWords(bech32.decode(address).words)).toString(
    "hex",
  )
}

export function randomAddress(prefix = "terra") {
  const RANDOM_WORDS = [...Array(64)]
    .map(() => Math.random().toString(16).slice(-1))
    .join("")

  return bech32.encode(prefix, bech32.toWords(Buffer.from(RANDOM_WORDS, "hex")))
}
