import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { useQuery } from "react-query"
import { useForm } from "react-hook-form"
import BigNumber from "bignumber.js"
import { AccAddress, Coin, Coins } from "@terra-money/feather.js"
import { MsgExecuteContract } from "@terra-money/feather.js"
import { isDenomTerra } from "@terra-money/terra-utils"
import { toAmount } from "@terra-money/terra-utils"

/* helpers */
import { has } from "utils/num"
import { queryKey } from "data/query"
import { useAddress } from "data/wallet"
import { queryTFMRoute, queryTFMSwap, TFM_ROUTER } from "data/external/tfm"

/* components */
import { Form, FormArrow, FormError, FormWarning } from "components/form"
import { Checkbox } from "components/form"
import { ReadToken } from "components/token"

/* tx modules */
import { getPlaceholder, toInput } from "../utils"
import validate from "../validate"
import Tx from "../Tx"

/* swap modules */
import AssetFormItem from "./components/AssetFormItem"
import { AssetInput, AssetReadOnly } from "./components/AssetFormItem"
import SelectToken from "./components/SelectToken"
import SlippageControl from "./components/SlippageControl"
import TFMExpectedPrice from "./TFMExpectedPrice"
import { SwapAssets, validateAssets } from "./useSwapUtils"
import { validateParams } from "./useSwapUtils"
import { calcMinimumReceive } from "./SingleSwapContext"
import { useTFMSwap, validateTFMSlippageParams } from "./TFMSwapContext"
import { useCustomTokensCW20 } from "data/settings/CustomTokens"
import { useNativeDenoms } from "data/token"

interface TFMSwapParams extends SwapAssets {
  amount: string
  slippage?: string
}

interface TxValues {
  offerAsset: string
  askAsset: string
  input: number | undefined
  slippageInput: number
}

interface TFMRouteLike {
  return_amount?: string
  input_amount?: string
  price_impact?: number | string
}

interface TFMCoinLike {
  denom: string
  amount: string
}

interface TFMSwapValueLike {
  contract?: string
  execute_msg?: Record<string, unknown>
  coins?: TFMCoinLike[]
}

interface TFMSwapLike {
  success?: boolean
  value?: TFMSwapValueLike
  error?: string
}

const TFMSwapForm = ({ chainID }: { chainID: string }) => {
  const { t } = useTranslation()
  const address = useAddress()
  const { state } = useLocation()

  // token whitelists
  const cw20 = useCustomTokensCW20()
  const readNativeDenom = useNativeDenoms()

  /* swap context */
  const { options, findTokenItem, findDecimals } = useTFMSwap()

  const initialOfferAsset =
    (state as Token) ??
    "ibc/B3504E092456BA618CC28AC671A71FB08C6CA0FD0BE7C8A5B5A3E2DD933CC9E4"

  const initialAskAsset = (state as Token) ?? "uluna"

  /* options */
  const [showAll, setShowAll] = useState(false)

  const getOptions = (key: "offerAsset" | "askAsset") => {
    const { coins, tokens } = options

    const getOptionList = (list: TokenItemWithBalance[]) =>
      list.map((item) => {
        const { token: value, balance } = item
        const hidden = key === "offerAsset" && !showAll && !has(balance)
        return { ...item, value, hidden }
      })

    return [
      { title: t("Coins"), children: getOptionList(coins) },
      { title: t("Tokens"), children: getOptionList(tokens) },
    ]
  }

  /* form */
  const form = useForm<TxValues>({
    mode: "onChange",
    defaultValues: {
      offerAsset: initialOfferAsset,
      askAsset: initialAskAsset,
      slippageInput: 1,
    },
  })

  const { register, trigger, watch, setValue, handleSubmit, formState } = form
  const { errors } = formState
  const values = watch()
  const { offerAsset, askAsset, input, slippageInput } = values

  const assets = useMemo(
    () => ({ offerAsset, askAsset }),
    [offerAsset, askAsset],
  )

  const slippageParams = useMemo(
    () => ({ offerAsset, askAsset, input, slippageInput }),
    [offerAsset, askAsset, input, slippageInput],
  )

  const offerTokenItem = offerAsset ? findTokenItem(offerAsset) : undefined
  const offerDecimals = offerAsset ? findDecimals(offerAsset) : 6
  const askDecimals = askAsset ? findDecimals(askAsset) : 6

  const amount =
    typeof input === "number" && Number.isFinite(input)
      ? toAmount(input, { decimals: offerDecimals })
      : ""

  const swapAssets = () => {
    setValue("offerAsset", askAsset)
    setValue("askAsset", offerAsset)
    setValue("input", undefined)
    trigger("input")
  }

  /* simulate | execute */
  const slippage = new BigNumber(slippageInput ?? 0).div(100).toString()
  const params = { ...assets, amount, slippage }
  const canSimulate = validateParams(params) && !!askAsset && !!offerAsset

  /* simulate */
  const { data: simulationResults, isFetching } = useQuery(
    ["TFM.simulate.swap", params],
    async () => {
      if (!canSimulate) return null

      const tfmParams = toTFMParams(params)
      const route = await queryTFMRoute(tfmParams)
      const swap = await queryTFMSwap(tfmParams)

      return [route, swap] as const
    },
    {
      enabled: canSimulate,
      retry: false,
    },
  )

  const routeResult = simulationResults?.[0] as TFMRouteLike | null | undefined
  const swapResult = simulationResults?.[1] as TFMSwapLike | null | undefined

  const simulatedValue = useMemo(() => {
    const returnAmount = routeResult?.return_amount
    if (!returnAmount) return
    return toAmount(returnAmount, { decimals: askDecimals })
  }, [askDecimals, routeResult])

  /* Select asset */
  const onSelectAsset = (key: "offerAsset" | "askAsset") => {
    return async (value: Token) => {
      const assets = {
        offerAsset: { offerAsset: value, askAsset },
        askAsset: { offerAsset, askAsset: value },
      }[key]

      if (assets.offerAsset === assets.askAsset) {
        setValue(key === "offerAsset" ? "askAsset" : "offerAsset", "")
      }

      if (key === "offerAsset") {
        form.resetField("input")
        form.setFocus("input")
      }

      setValue(key, value)
    }
  }

  /* tx */
  const balance = offerTokenItem?.balance

  const createTx = useCallback(() => {
    if (!address) return
    if (!offerAsset) return
    if (!swapResult?.value) return

    const value = swapResult.value
    const executeMsg = value.execute_msg

    if (!executeMsg || typeof executeMsg !== "object") return

    const contract =
      value.contract && AccAddress.validate(value.contract)
        ? value.contract
        : TFM_ROUTER

    const finalExecuteMsg =
      AccAddress.validate(offerAsset) &&
      "send" in executeMsg &&
      executeMsg.send &&
      typeof executeMsg.send === "object"
        ? {
            ...executeMsg,
            send: {
              ...(executeMsg.send as Record<string, unknown>),
              contract: TFM_ROUTER,
            },
          }
        : executeMsg

    const coins = new Coins(
      (value.coins ?? []).map((coin) =>
        Coin.fromData({
          denom: coin.denom,
          amount: coin.amount,
        }),
      ),
    )

    return {
      msgs: [new MsgExecuteContract(address, contract, finalExecuteMsg, coins)],
      chainID,
    }
  }, [address, offerAsset, swapResult, chainID])

  /* fee */
  const { data: estimationTxValues } = useQuery(
    ["estimationTxValues", { assets, input, slippageInput }],
    async () => {
      if (!validateAssets(assets)) return
      return { offerAsset, askAsset, input, slippageInput: 1 }
    },
  )

  const token = offerAsset
  const decimals = offerDecimals
  const tx = {
    token,
    decimals,
    amount,
    balance,
    estimationTxValues,
    createTx,
    queryKeys: [
      queryKey.bank.balances,
      queryKey.bank.balance,
      queryKey.wasm.contractQuery,
    ],
    onSuccess: () => {
      if (askAsset && AccAddress.validate(askAsset)) {
        const data = readNativeDenom(askAsset)
        cw20.add({
          ...data,
          token: askAsset,
          name: data.name ?? data.symbol,
        })
      }
    },
    chain: chainID,
  }

  const disabled = isFetching ? t("Simulating...") : false

  /* render: expected price */
  const renderExpected = () => {
    if (!simulatedValue) return null
    if (!validateTFMSlippageParams(slippageParams)) return null
    if (!routeResult?.return_amount || !routeResult?.input_amount) return null

    const inputAmount = new BigNumber(routeResult.input_amount)
    const returnAmount = new BigNumber(routeResult.return_amount)

    if (returnAmount.isZero()) return null

    const expected = {
      minimum_receive: calcMinimumReceive(simulatedValue, slippage),
      price: inputAmount.div(returnAmount).toNumber(),
      price_impact: Number(routeResult.price_impact ?? 0),
    }

    const props = { ...slippageParams, ...expected }
    return <TFMExpectedPrice {...props} />
  }

  const slippageDisabled = [offerAsset, askAsset].every(isDenomTerra)

  const isFailed = useMemo(() => {
    if (!swapResult) return false
    if (swapResult.success === false) return true
    if (swapResult.error) return true
    return false
  }, [swapResult])

  return (
    <Tx {...tx} disabled={disabled}>
      {({ max, fee, submit }) => (
        <Form onSubmit={handleSubmit(submit.fn)}>
          <FormWarning>
            {t("Leave coins to pay fees for subsequent transactions")}
          </FormWarning>

          <AssetFormItem
            label={t("From")}
            extra={max.render(async (value) => {
              setValue("input", toInput(value, offerDecimals))
              await trigger("input")
            })}
            error={errors.input?.message}
          >
            <SelectToken
              value={offerAsset}
              onChange={onSelectAsset("offerAsset")}
              options={getOptions("offerAsset")}
              checkbox={
                <Checkbox
                  checked={showAll}
                  onChange={() => setShowAll(!showAll)}
                >
                  {t("Show all")}
                </Checkbox>
              }
              addonAfter={
                <AssetInput
                  {...register("input", {
                    valueAsNumber: true,
                    validate: validate.input(
                      toInput(max.amount, offerDecimals),
                      offerDecimals ?? 6,
                    ),
                  })}
                  inputMode="decimal"
                  type="number"
                  placeholder={getPlaceholder(offerDecimals)}
                  onFocus={max.reset}
                  autoFocus
                />
              }
              showName
            />
          </AssetFormItem>

          <FormArrow onClick={swapAssets} />

          <AssetFormItem label={t("To")}>
            <SelectToken
              value={askAsset}
              onChange={onSelectAsset("askAsset")}
              options={getOptions("askAsset")}
              addonAfter={
                <AssetReadOnly>
                  {simulatedValue ? (
                    <ReadToken
                      amount={simulatedValue}
                      denom={askAsset ?? ""}
                      approx
                      hideDenom
                    />
                  ) : (
                    <p className="muted">
                      {isFetching ? t("Simulating...") : "0"}
                    </p>
                  )}
                </AssetReadOnly>
              }
              showName
            />
          </AssetFormItem>

          {!slippageDisabled && (
            <SlippageControl
              {...register("slippageInput", {
                valueAsNumber: true,
                validate: validate.input(50, 2, "Slippage tolerance"),
              })}
              input={slippageInput}
              inputMode="decimal"
              type="number"
              placeholder={getPlaceholder(2)}
              error={errors.slippageInput?.message}
            />
          )}

          {renderExpected()}
          {fee.render()}

          {validateAssets(assets) && isFailed && (
            <FormError>{t("Pair does not exist")}</FormError>
          )}

          {submit.button}
        </Form>
      )}
    </Tx>
  )
}

export default TFMSwapForm

/* helpers */
const toTFMParams = (params: TFMSwapParams) => {
  const { offerAsset: token0, askAsset: token1, amount } = params
  return { ...params, token0, token1, amount, use_split: true }
}
