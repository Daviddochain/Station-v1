import { ReactNode, useMemo } from "react"
import { useLocation } from "react-router-dom"
import Tippy, { TippyProps } from "@tippyjs/react"
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined"
import { InlineFlex } from "../layout"

const EMPTY_PLUGINS: NonNullable<TippyProps["plugins"]> = []

const normalizeTippyProps = (
  props: TippyProps,
  defaults?: Partial<TippyProps>,
): TippyProps => {
  const normalized: TippyProps = {
    ...defaults,
    ...props,
  }

  if (!normalized.plugins) {
    normalized.plugins = EMPTY_PLUGINS
  }

  if (!normalized.delay) {
    normalized.delay = [0, 0]
  }

  if (!normalized.duration) {
    normalized.duration = [0, 0]
  }

  return normalized
}

export const Popover = ({ theme = "popover", ...props }: TippyProps) => {
  const { pathname } = useLocation()

  const normalizedProps = useMemo(
    () =>
      normalizeTippyProps(props, {
        theme,
        arrow: theme !== "none",
        trigger: "click",
        animation: false,
        maxWidth: 360,
        interactive: true,
      }),
    [props, theme],
  )

  return <Tippy key={pathname} {...normalizedProps} />
}

const Tooltip = (props: TippyProps) => {
  const normalizedProps = useMemo(
    () =>
      normalizeTippyProps(props, {
        animation: false,
      }),
    [props],
  )

  return <Tippy {...normalizedProps} />
}

export default Tooltip

/* derive */
interface Props extends Omit<TippyProps, "children"> {
  children?: ReactNode
}

export const TooltipIcon = (props: Props) => {
  return (
    <InlineFlex gap={4} start>
      {props.children}
      <Tooltip {...props}>
        <HelpOutlineOutlinedIcon fontSize="inherit" className="muted" />
      </Tooltip>
    </InlineFlex>
  )
}
