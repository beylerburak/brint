"use client"

import { useState } from "react"
import { useRouter, usePathname, useParams, useSearchParams } from "next/navigation"
import { useLocale } from "next-intl"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, ApiError } from "@/lib/api-client"
import { buildSignupUrl, buildWorkspaceUrl, buildLoginUrl, getLocaleFromPathnameOrParams, removeLocalePrefix, withLocale } from "@/lib/locale-path"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract locale from pathname or params
  const currentLocale = getLocaleFromPathnameOrParams(pathname, params as { locale?: string }) || locale

  // Get 'from' parameter from URL (safe redirect)
  const fromParam = searchParams.get('from')

  /**
   * Validate and normalize redirect path to prevent open redirect attacks
   * 
   * This function is used for BOTH 'from' query param and API 'redirectTo' response
   * to ensure consistent security validation across all redirect sources.
   * 
   * Security checks (applied to all redirect sources):
   * - Rejects protocol-relative URLs (//example.com)
   * - Rejects external URLs (http://, https://)
   * - Rejects dangerous schemes (javascript:, data:)
   * - Only allows internal paths (starting with /)
   * - Normalizes locale prefix with current locale
   */
  function normalizeRedirectPath(path: string | null, defaultPath: string): string {
    if (!path) {
      return defaultPath
    }

    // Security: Reject protocol-relative URLs (//example.com)
    if (path.startsWith('//')) {
      console.warn('[Security] Rejected protocol-relative URL:', path)
      return defaultPath
    }

    // Security: Reject external URLs (http://, https://)
    if (path.match(/^https?:\/\//i)) {
      console.warn('[Security] Rejected external URL:', path)
      return defaultPath
    }

    // Security: Reject dangerous schemes (javascript:, data:, vbscript:, etc.)
    if (path.match(/^(javascript|data|vbscript|file):/i)) {
      console.warn('[Security] Rejected dangerous scheme:', path)
      return defaultPath
    }

    // Security: Only allow internal paths (starting with /)
    if (!path.startsWith('/')) {
      console.warn('[Security] Rejected non-absolute path:', path)
      return defaultPath
    }

    // Remove locale prefix if present (uses locales array from single source: lib/i18n/locales.ts)
    const pathWithoutLocale = removeLocalePrefix(path)
    
    // Normalize with current locale (ensures consistent locale prefix)
    return withLocale(currentLocale, pathWithoutLocale)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await apiClient.login({ email, password })

      // Success - handle redirect
      // Priority: 1) from param (safe redirect), 2) API redirectTo, 3) default root
      let redirectPath: string

      if (fromParam) {
        // Use 'from' query parameter with strict security validation
        redirectPath = normalizeRedirectPath(fromParam, `/${currentLocale}`)
      } else if (result.redirectTo) {
        // Handle redirectTo from API - apply SAME strict security validation as 'from'
        // normalizeRedirectPath() ensures: no //, no http://, no javascript:, no data:, only internal paths
        const normalizedPath = normalizeRedirectPath(result.redirectTo, `/${currentLocale}`)
        
        // After security validation and locale normalization, detect workspace paths
        // normalizedPath already has locale prefix (e.g., /tr/workspace/home)
        // Remove locale to check if first segment is a workspace slug
        const pathWithoutLocale = removeLocalePrefix(normalizedPath)
        const segments = pathWithoutLocale.split('/').filter(Boolean)
        
        // Check if it's a workspace path (not login/signup/onboarding/auth)
        if (segments.length >= 1 && 
            segments[0] !== 'login' && 
            segments[0] !== 'signup' && 
            segments[0] !== 'onboarding' &&
            segments[0] !== 'auth') {
          // Likely a workspace path - use buildWorkspaceUrl for proper locale handling
          const workspaceSlug = segments[0]
          const path = segments.slice(1).join('/') || 'home'
          redirectPath = buildWorkspaceUrl(currentLocale, workspaceSlug, `/${path}`)
        } else {
          // Simple path (login, signup, etc.) - already normalized by normalizeRedirectPath
          redirectPath = normalizedPath
        }
      } else {
        // Default: go to root (which will redirect to first workspace)
        redirectPath = `/${currentLocale}`
      }

      router.push(redirectPath)
      router.refresh()
    } catch (err) {
      // Handle API errors
      if (err instanceof ApiError) {
        // If email is not verified, redirect to signup page (without storing password)
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          const signupPath = `${buildSignupUrl(currentLocale)}?email=${encodeURIComponent(email)}&verify=true`
          router.push(signupPath)
          return
        }
        
        setError(err.message || 'Login failed')
      } else {
        setError('An error occurred. Please try again.')
        console.error('Login error:', err)
      }
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          {error && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  )
}

