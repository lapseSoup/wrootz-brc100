interface ErrorMessageProps {
  message: string
  className?: string
}

export default function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={`p-3 rounded-lg text-sm bg-[var(--danger)] text-white ${className}`}
    >
      {message}
    </div>
  )
}
