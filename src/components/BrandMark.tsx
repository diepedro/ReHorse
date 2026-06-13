interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASS = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
}

export default function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/icons/rehorse-mark-96.png"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  )
}
