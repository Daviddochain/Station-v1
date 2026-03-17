import React, { CSSProperties, ReactNode, useMemo, useState } from "react"
import { path } from "ramda"
import classNames from "classnames/bind"
import { ReactComponent as DropUpIcon } from "styles/images/icons/DropUp.svg"
import { ReactComponent as DropDownIcon } from "styles/images/icons/DropDown.svg"
import { TooltipIcon } from "components/display"
import Grid from "./Grid"
import PaginationButtons from "./PaginationButtons"
import styles from "./Table.module.scss"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"

const cx = classNames.bind(styles)

type SortOrder = "desc" | "asc"
type Sorter<T> = (a: T, b: T) => number

interface Column<T> {
  title?: string | ReactNode
  tooltip?: string
  dataIndex?: string | string[]
  defaultSortOrder?: SortOrder
  sorter?: Sorter<T>
  render?: (value: any, record: T, index: number) => ReactNode
  key?: string
  align?: "left" | "center" | "right"
  hidden?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  dataSource: T[]
  filter?: (record: T) => boolean
  sorter?: (a: T, b: T) => number
  rowKey?: (record: T) => string
  initialSorterKey?: string
  onSort?: () => void
  extra?: (data: T) => ReactNode
  className?: string
  size?: "default" | "small"
  bordered?: boolean
  style?: CSSProperties
  pagination?: number
}

function Table<T>({
  dataSource,
  filter,
  rowKey,
  sorter: propSorter,
  columns: rawColumns,
  initialSorterKey,
  onSort,
  extra,
  className,
  size = "default",
  bordered,
  style,
  pagination,
}: Props<T>) {
  const columns = rawColumns.filter(({ hidden }) => !hidden)

  const getClassName = ({ align, dataIndex }: Column<T>) => cx(align, dataIndex)
  const getRowId = (data: T, index: number) => rowKey?.(data) ?? String(index)

  const [page, setPage] = useState(1)

  const range = useMemo(() => {
    if (!pagination) return undefined
    const start = (page - 1) * pagination
    const end = page * pagination
    return [start, end] as const
  }, [page, pagination])

  const initIndex = () => {
    if (!initialSorterKey) return
    const index = columns.findIndex(({ key }) => key === initialSorterKey)
    if (index > -1) return index
  }

  const initOrder = () => {
    const index = initIndex()
    if (typeof index === "number" && index > -1) {
      return columns[index].defaultSortOrder
    }
  }

  const [sorterIndex, setSorterIndex] = useState<number | undefined>(initIndex)
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(initOrder)
  const [extraActive, setActive] = useState<string | undefined>()

  const sorter = useMemo(() => {
    if (typeof sorterIndex !== "number") return
    const columnSorter = columns[sorterIndex]?.sorter
    if (!columnSorter) return

    return (a: T, b: T) => {
      return (sortOrder === "desc" ? -1 : 1) * columnSorter(a, b)
    }
  }, [columns, sortOrder, sorterIndex])

  const sortedData = useMemo(() => {
    return [...dataSource]
      .filter((data) => filter?.(data) ?? true)
      .sort((a, b) => propSorter?.(a, b) || sorter?.(a, b) || 0)
  }, [dataSource, filter, propSorter, sorter])

  const pagedData = useMemo(() => {
    if (!range) return sortedData
    return sortedData.slice(...range)
  }, [sortedData, range])

  const renderPagination = () => {
    if (!pagination) return null
    const total = Math.ceil(sortedData.length / pagination)
    if (!total || total === 1) return null

    const prevPage = page > 1 ? () => setPage((p) => p - 1) : undefined
    const nextPage = page < total ? () => setPage((p) => p + 1) : undefined

    return (
      <footer className={styles.pagination}>
        <PaginationButtons
          current={page}
          total={total}
          onPrev={prevPage}
          onNext={nextPage}
        />
      </footer>
    )
  }

  const sort = (index: number) => {
    const { defaultSortOrder } = columns[index]
    const opposite = { asc: "desc" as const, desc: "asc" as const }
    const next =
      sorterIndex === index && sortOrder
        ? opposite[sortOrder]
        : defaultSortOrder

    setSorterIndex(index)
    setSortOrder(next)
    onSort?.()
  }

  return (
    <div
      className={cx(styles.container, className, { bordered })}
      style={style}
    >
      <table className={cx(styles.table, size)}>
        {columns.some((col) => !!col.title) && (
          <thead>
            <tr>
              {extra && <th></th>}
              {columns.map((column, index) => {
                const { title, tooltip, sorter, defaultSortOrder } = column

                const getCaretAttrs = (key: SortOrder) => {
                  const active = sorterIndex === index && sortOrder === key
                  return {
                    className: cx(styles.caret, { active }),
                    width: 6,
                    height: 3,
                  }
                }

                return (
                  <th
                    className={getClassName(column)}
                    key={column.key ?? index}
                  >
                    {sorter && defaultSortOrder ? (
                      <button
                        type="button"
                        className={styles.sorter}
                        onClick={() => sort(index)}
                      >
                        {tooltip ? (
                          <TooltipIcon content={tooltip}>{title}</TooltipIcon>
                        ) : (
                          title
                        )}

                        <Grid gap={4}>
                          <DropUpIcon {...getCaretAttrs("asc")} />
                          <DropDownIcon {...getCaretAttrs("desc")} />
                        </Grid>
                      </button>
                    ) : (
                      title
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
        )}

        <tbody>
          {pagedData.map((data, index) => {
            const rowId = getRowId(data, index)
            const isExtraActive = extraActive === rowId

            return (
              <React.Fragment key={rowId}>
                <tr className={styles.row}>
                  {extra && (
                    <td className={styles.extra__tooltip}>
                      <button
                        type="button"
                        onClick={() =>
                          setActive((current) =>
                            current !== rowId ? rowId : undefined,
                          )
                        }
                        className={isExtraActive ? styles.active : ""}
                      >
                        <KeyboardArrowRightIcon />
                      </button>
                    </td>
                  )}

                  {columns.map((column, columnIndex) => {
                    const { dataIndex, render } = column
                    const value: any =
                      typeof dataIndex === "string"
                        ? data[dataIndex as keyof T]
                        : dataIndex
                          ? path(dataIndex, data)
                          : undefined

                    const children = render?.(value, data, index) ?? value

                    return (
                      <td
                        className={getClassName(column)}
                        key={column.key ?? columnIndex}
                      >
                        {children}
                      </td>
                    )
                  })}
                </tr>

                {extra && (
                  <tr
                    className={cx(
                      styles.extra__content,
                      !isExtraActive && styles.extra__content__disabled,
                    )}
                  >
                    <td colSpan={columns.length + 1}>
                      {isExtraActive && extra(data)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>

      {renderPagination()}
    </div>
  )
}

export default Table
