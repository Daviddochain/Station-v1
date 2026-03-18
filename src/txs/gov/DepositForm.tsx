import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { MsgDeposit } from "@terra-money/feather.js"
import { toAmount } from "@terra-money/terra-utils"
import { queryKey } from "data/query"
import { useBankBalance } from "data/queries/bank"
import { Form, FormItem, Input } from "components/form"
import useProposalId from "pages/gov/useProposalId"
import { getPlaceholder, toInput } from "../utils"
import validate from "../validate"
import Tx from "../Tx"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { useNetwork } from "data/wallet"
import { useNativeDenoms } from "data/token"

interface TxValues {
  input: number
}

const DepositForm = () => {
  const { t } = useTranslation()
  const { id, chain } = useProposalId()
  const addresses = useInterchainAddresses()
  const networks = useNetwork()
  const readNativeDenom = useNativeDenoms()

  const bankBalance = useBankBalance()
  const token = networks[chain]?.baseAsset ?? ""

  const balance =
    bankBalance.find((b) => b.chain === chain && b.denom === token)?.amount ??
    "0"

  const form = useForm<TxValues>({ mode: "onChange" })
  const { register, trigger, watch, setValue, handleSubmit, formState } = form
  const { errors } = formState
  const { input } = watch()

  const decimals = readNativeDenom(token, chain).decimals ?? 6
  const amount = toAmount(input, { decimals })

  const createTx = useCallback(
    ({ input }: TxValues) => {
      if (!addresses || !token) return

      const amount = toAmount(input, { decimals })
      const msgs = [
        new MsgDeposit(Number(id), addresses[chain], amount + token),
      ]

      return { msgs, chainID: chain }
    },
    [addresses, id, chain, token, decimals],
  )

  const estimationTxValues = useMemo(
    () => ({ input: toInput(balance, decimals) }),
    [balance, decimals],
  )

  const onChangeMax = useCallback(
    async (input: number) => {
      setValue("input", input)
      await trigger("input")
    },
    [setValue, trigger],
  )

  const tx = {
    token,
    amount,
    balance,
    estimationTxValues,
    createTx,
    onChangeMax,
    queryKeys: [[queryKey.gov.deposits, id]],
    chain,
  }

  return (
    <Tx {...tx}>
      {({ max, fee, submit }) => (
        <Form onSubmit={handleSubmit(submit.fn)}>
          <FormItem
            label={t("Amount")}
            extra={max.render()}
            error={errors.input?.message}
          >
            <Input
              {...register("input", {
                valueAsNumber: true,
                validate: validate.input(
                  toInput(max.amount, decimals),
                  decimals,
                ),
              })}
              token={token}
              onFocus={max.reset}
              type="number"
              inputMode="decimal"
              placeholder={getPlaceholder(decimals)}
              autoFocus
            />
          </FormItem>

          {fee.render()}
          {submit.button}
        </Form>
      )}
    </Tx>
  )
}

export default DepositForm
