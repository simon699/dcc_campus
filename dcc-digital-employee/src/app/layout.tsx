import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AuthProvider } from '../contexts/AuthContext'

export const metadata: Metadata = {
  title: '数字员工平台',
  description: '管理和监控数字员工的现代化SAAS平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body 
        className="font-sans transition-colors duration-200"
        suppressHydrationWarning={true}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 