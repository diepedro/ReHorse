'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  value: string
  size?: number
}

export default function QrCode({ value, size = 200 }: Props) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let cancelled = false

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((nextUrl) => {
        if (!cancelled) setUrl(nextUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl('')
      })

    return () => {
      cancelled = true
    }
  }, [size, value])

  return (
    <div
      className="flex items-center justify-center rounded-lg border border-gray-200 bg-white text-center text-[10px] text-gray-400"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt={`QR Code: ${value}`}
          width={size}
          height={size}
          className="rounded-lg"
        />
      ) : (
        <span className="px-3">QR indisponível</span>
      )}
    </div>
  )
}
