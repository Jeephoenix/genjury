import React, { memo } from 'react'
import { AlertCircle, Check } from 'lucide-react'

/**
 * FormInput — reusable input with validation, error states, and accessibility
 * Prevents prop spreading issues and standardizes form styling
 */
const FormInput = memo(function FormInput({
  label,
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  onBlur,
  error = null,
  success = false,
  disabled = false,
  required = false,
  maxLength,
  pattern,
  autoComplete,
  className = '',
  ...props
}) {
  const id = React.useId()
  const hasError = error && error.length > 0
  const showSuccess = success && !hasError && value.length > 0

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium transition-colors ${
            hasError ? 'text-signal' : showSuccess ? 'text-neon' : 'text-white/80'
          }`}
        >
          {label}
          {required && <span className="ml-1 text-signal">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete}
          required={required}
          className={`
            w-full px-4 py-2.5 rounded-xl
            bg-white/[0.04] border transition-all duration-200
            text-white placeholder-white/40
            focus:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-white/[0.06]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? 'border-signal/50 focus:border-signal focus:ring-signal/40'
              : showSuccess
              ? 'border-neon/50 focus:border-neon focus:ring-neon/40'
              : 'border-white/10 focus:border-plasma focus:ring-plasma/40'
            }
            ${className}
          `}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          {...props}
        />

        {showSuccess && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon pointer-events-none" />
        )}
        {hasError && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-signal pointer-events-none" />
        )}
      </div>

      {hasError && (
        <p id={`${id}-error`} className="text-xs text-signal/80">
          {error}
        </p>
      )}
    </div>
  )
})

export default FormInput
