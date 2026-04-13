import classNames from 'classnames'
import { ChangeEventHandler, useContext, useEffect, useRef } from 'react'
import ContextProvider from 'frontend/state/ContextProvider'
import './index.css'

interface Props {
  htmlId: string
  handleChange: ChangeEventHandler<HTMLInputElement>
  value: unknown
  title: string
  disabled?: boolean
  extraClass?: string
  description?: string
  fading?: boolean
  /** Tri-state checkbox: when true, `value` should be false; not all usages support this. */
  indeterminate?: boolean
}

export default function ToggleSwitch(props: Props) {
  const {
    handleChange,
    value,
    disabled,
    title,
    htmlId,
    extraClass,
    description = '',
    fading,
    indeterminate = false
  } = props
  const { isRTL } = useContext(ContextProvider)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.indeterminate = indeterminate
    }
  }, [indeterminate, value])

  const checked = Boolean(value)

  return (
    <>
      <input
        ref={inputRef}
        id={htmlId}
        disabled={disabled}
        checked={checked}
        type="checkbox"
        onChange={handleChange}
        aria-label={title}
        aria-checked={indeterminate ? 'mixed' : checked}
        className="hiddenCheckbox"
      />
      <label
        className={classNames(`toggleSwitchWrapper Field ${extraClass}`, {
          isRTL,
          fading,
          'toggleSwitchWrapper--indeterminate': indeterminate
        })}
        htmlFor={htmlId}
        title={description}
      >
        {title}
      </label>
    </>
  )
}
