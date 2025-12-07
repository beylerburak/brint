"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OTPInput } from "input-otp"
import { OTPInputSlot } from "@/components/ui/otp-input"
import { apiClient } from "@/lib/api-client"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const loginPath = locale === "en" ? "/login" : `/${locale}/login`

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // OTP state
  const [showOTP, setShowOTP] = useState(false)
  const [otpValue, setOtpValue] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)

  // Check query params for email verification redirect from login
  useEffect(() => {
    const emailParam = searchParams.get('email')
    const verifyParam = searchParams.get('verify')
    
    if (emailParam && verifyParam === 'true') {
      setEmail(emailParam)
      setShowOTP(true)
      
      // Get password from sessionStorage if coming from login
      if (typeof window !== 'undefined') {
        const pendingPassword = sessionStorage.getItem('pendingLoginPassword')
        const pendingEmail = sessionStorage.getItem('pendingLoginEmail')
        if (pendingPassword && pendingEmail === emailParam) {
          setPassword(pendingPassword)
        }
      }
      
      // Resend verification code
      apiClient.resendVerificationCode({ email: emailParam })
        .then(() => {
          toast.success("Verification code sent to your email")
        })
        .catch((err) => {
          toast.error("Failed to resend verification code")
        })
    }
  }, [searchParams])

  // Extract locale from pathname for redirect
  const pathParts = pathname.split('/').filter(Boolean)
  const potentialLocale = pathParts[0]
  const currentLocale = ['en', 'tr'].includes(potentialLocale) ? potentialLocale : ''

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const result = await apiClient.register({
        email,
        password,
        name,
      })

      if (result.success && result.data.requiresEmailVerification) {
        // Show OTP input
        setShowOTP(true)
        toast.success("Verification code sent to your email")
      }
    } catch (err: any) {
      // ApiError has message, code, and statusCode
      const errorCode = err?.code || err?.error?.code
      const errorMessage = err?.message || err?.error?.message || "Failed to create account"
      
      // If user exists but email not verified, try to resend code and show OTP
      if (errorCode === 'AUTH_USER_EXISTS') {
        try {
          // Try to resend verification code
          await apiClient.resendVerificationCode({ email })
          setShowOTP(true)
          toast.success("Verification code sent to your email")
          setError(null)
        } catch (resendErr: any) {
          // If resend fails, show error
          setError(errorMessage)
          toast.error(errorMessage)
        }
      } else {
        setError(errorMessage)
        toast.error(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) {
      toast.error("Please enter the 6-digit code")
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const result = await apiClient.verifyEmailCode({
        email,
        code: otpValue,
      })

      if (result.success && result.data.emailVerified) {
        toast.success("Email verified successfully!")
        
        // Clear sessionStorage if password was stored
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pendingLoginPassword')
          sessionStorage.removeItem('pendingLoginEmail')
        }
        
        // Automatically login after verification if password is available
        if (password) {
          try {
            const loginResult = await apiClient.login({
              email,
              password,
            })

            if (loginResult.success) {
              // Redirect to the appropriate path
              const redirectPath = currentLocale
                ? `/${currentLocale}${loginResult.redirectTo || '/'}`
                : loginResult.redirectTo || '/'
              
              router.push(redirectPath)
              router.refresh()
              return
            }
          } catch (loginErr: any) {
            // If auto-login fails, redirect to login page
            console.error('Auto-login failed:', loginErr)
          }
        }
        
        // If no password or login failed, redirect to login page
        toast.info("Email verified. Please login.")
        const loginPathWithLocale = currentLocale
          ? `/${currentLocale}/login`
          : '/login'
        router.push(loginPathWithLocale)
      }
    } catch (err: any) {
      // ApiError has message, code, and statusCode
      const errorMessage = err?.message || err?.error?.message || "Invalid verification code"
      setError(errorMessage)
      toast.error(errorMessage)
      setOtpValue("") // Clear OTP on error
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setIsResending(true)
    setError(null)

    try {
      await apiClient.resendVerificationCode({ email })
      toast.success("Verification code resent to your email")
      setOtpValue("") // Clear current OTP
    } catch (err: any) {
      // ApiError has message, code, and statusCode
      const errorMessage = err?.message || err?.error?.message || "Failed to resend code"
      toast.error(errorMessage)
    } finally {
      setIsResending(false)
    }
  }

  // Show OTP input if signup was successful
  if (showOTP) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">{t("verifyEmail") || "Verify your email"}</h1>
            <p className="text-muted-foreground text-sm text-balance">
              {t("verifyEmailDescription") || `We've sent a 6-digit code to ${email}. Please enter it below.`}
            </p>
          </div>
          
          {error && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Field>
            <FieldLabel>{t("verificationCode") || "Verification Code"}</FieldLabel>
            <OTPInput
              maxLength={6}
              value={otpValue}
              onChange={setOtpValue}
              disabled={isVerifying}
              render={({ slots }) => (
                <div className="flex items-center gap-2">
                  {slots.map((slot, idx) => (
                    <OTPInputSlot key={idx} {...slot} />
                  ))}
                </div>
              )}
            />
            <FieldDescription>
              {t("verificationCodeDescription") || "Enter the 6-digit code sent to your email"}
            </FieldDescription>
          </Field>

          <Field>
            <Button 
              type="button" 
              onClick={handleVerifyOTP}
              disabled={isVerifying || otpValue.length !== 6}
              className="w-full"
            >
              {isVerifying ? (t("verifying") || "Verifying...") : (t("verify") || "Verify")}
            </Button>
          </Field>

          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={handleResendCode}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (t("resending") || "Resending...") : (t("resendCode") || "Resend Code")}
            </Button>
          </Field>

          <FieldSeparator>{t("or") || "or"}</FieldSeparator>

          <Field>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowOTP(false)
                setOtpValue("")
                setError(null)
              }}
              className="w-full"
            >
              {t("backToSignup") || "Back to signup"}
            </Button>
          </Field>
        </FieldGroup>
      </div>
    )
  }

  // Show signup form
  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSignup} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("signupTitle")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("signupDescription")}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="name">{t("fullName")}</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder={t("fullNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
          />
          <FieldDescription>
            {t("emailDescription")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
          <FieldDescription>
            {t("passwordDescription")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">{t("confirmPassword")}</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
          <FieldDescription>{t("confirmPasswordDescription")}</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (t("creating") || "Creating account...") : t("createAccount")}
          </Button>
        </Field>
        <FieldSeparator>{t("orContinueWith")}</FieldSeparator>
        <Field>
          <Button variant="outline" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("continueWithGoogle")}
          </Button>
          <FieldDescription className="px-6 text-center">
            {t("alreadyHaveAccount")} <Link href={loginPath}>{t("signIn")}</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
