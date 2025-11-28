"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { cn } from "@/shared/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requestMagicLink, getGoogleOAuthUrl } from "@/features/auth/api/auth-api"
import { useToast } from "@/components/ui/use-toast"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("common")
  const locale = useLocale()
  const searchParams = useSearchParams()
  const signupPath = locale === "en" ? "/signup" : `/${locale}/signup`
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true)
    try {
      const redirectTo = searchParams.get("redirectTo") || undefined
      await requestMagicLink(data.email, redirectTo)
      toast({
        title: "Magic link sent",
        description: "Check your email for the magic link to sign in.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send magic link",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleRedirecting(true)
    try {
      const url = await getGoogleOAuthUrl()
      window.location.href = url
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start Google login",
        variant: "destructive",
      })
      setIsGoogleRedirecting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-6 text-center">
            <a
              href="#"
              className="flex flex-col items-center font-medium"
            >
              <div className="flex items-center justify-center">
                <svg 
                  width="71" 
                  height="48" 
                  viewBox="0 0 373 252" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-foreground"
                  aria-label="Beyler Interactive"
                >
                  <path 
                    d="M367.537 93.7351C352.846 76.0434 291.494 61.2485 291.494 61.2485C263.042 54.4201 274.837 56.4894 245.868 49.7644C219.485 43.5568 197.655 38.9011 182.757 35.9007C181.826 35.6938 180.791 35.4869 179.86 35.28C179.86 35.28 147.477 27.417 125.336 21.1059C110.749 16.864 89.953 10.2426 64.9156 0C60.4668 0.620762 55.7076 1.96575 53.9488 4.65572C49.5 11.3806 47.7411 19.6575 45.0512 27.5205C45.0512 27.7274 44.9477 27.9343 44.8442 28.1412C44.8442 28.3481 44.7408 28.5551 44.6373 28.762C42.4647 34.9696 65.9502 60.007 72.2612 72.2153C78.3654 84.1133 84.573 99.0116 87.263 114.738C87.5734 116.703 87.8838 118.772 87.9872 120.945C83.2281 118.048 76.8135 115.255 69.054 114.634C56.7422 113.599 47.5342 118.359 42.0508 121.256C14.4269 136.05 5.83969 167.088 3.56356 175.158C-4.40288 203.817 2.73588 227.509 8.01236 234.855C10.4954 238.373 13.5992 241.373 13.5992 241.373C16.0823 244.477 20.2207 248.719 26.3248 250.788C43.0854 256.375 60.4668 241.063 65.1225 237.028C72.6751 230.406 76.6066 223.681 81.3658 215.508C84.1592 210.852 89.746 200.61 93.6775 186.642C94.2983 184.573 97.0917 174.641 98.3333 161.191C98.5402 158.708 99.2644 150.121 98.6436 138.223C98.3333 132.533 97.1952 117.117 92.5395 100.46C84.4696 72.0084 68.847 50.6956 59.7425 39.7288C63.2602 40.453 68.5367 41.4876 74.8477 42.5222C93.3672 45.626 107.231 46.7641 113.335 47.4883C137.959 50.4887 155.03 52.144 169.514 53.7994C223.52 60.1105 276.595 70.2496 327.705 89.0794C335.568 91.9763 343.224 95.5974 351.087 98.8046C353.363 99.8392 353.777 100.357 353.673 100.563C353.673 100.77 353.156 100.874 352.535 100.977C351.708 101.081 350.983 100.977 350.57 100.977C348.397 100.977 345.19 101.288 341.258 101.081C298.633 98.9081 256.11 95.9078 213.485 94.8732C192.999 94.3559 172.514 97.0458 152.029 99.115C142.925 100.046 137.959 108.737 137.545 121.566C137.545 123.635 137.855 125.29 138.579 126.635C139.614 128.705 141.787 131.705 149.339 133.981C157.306 136.361 164.031 135.74 167.755 135.43C177.17 134.705 186.688 136.05 196.103 136.154C197.655 136.154 218.865 136.464 236.453 138.326C248.144 139.568 264.594 142.155 284.252 148.259C289.425 149.293 292.735 151.569 292.528 153.018C292.321 154.466 288.804 155.915 284.045 155.915C281.665 156.432 279.285 157.053 276.906 157.57C240.695 165.537 204.38 173.296 168.169 181.366C153.581 184.573 139.924 189.022 140.442 208.059C140.442 208.369 140.131 208.68 140.131 208.886C140.959 213.439 140.649 218.922 143.235 222.129C144.89 224.095 150.891 222.854 154.926 222.336C157.409 222.026 159.892 220.371 162.168 219.129C193.413 202.886 226.21 190.884 260.663 183.228C276.078 179.814 291.39 175.055 306.289 169.778C310.427 168.33 315.703 162.743 315.807 158.915C315.807 155.397 310.117 150.121 305.875 148.776C291.597 144.224 277.009 140.603 262.318 137.602C239.66 133.05 216.899 129.429 194.138 125.497C193.724 125.497 190.413 124.877 190.413 124.359C190.413 123.739 193.931 123.428 194.241 123.325C220.623 123.118 247.006 122.911 273.388 122.807C300.702 122.807 328.015 123.118 355.329 122.807C360.088 122.807 364.951 121.669 368.158 118.255C369.917 116.393 370.641 114.22 371.158 112.668C371.572 111.323 373.331 105.736 371.158 99.5289C371.158 99.5289 370.02 96.425 367.847 93.7351H367.537ZM75.3651 192.643C70.192 203.507 66.0536 211.783 57.6733 220.267C52.0865 225.957 44.5339 233.51 36.464 231.751C32.2221 230.82 29.3252 227.716 27.5664 225.233C26.7387 223.164 25.6006 220.164 24.7729 216.543C17.8411 185.918 41.1197 158.915 43.6027 156.122C59.9495 137.602 80.745 132.533 88.8149 130.981C89.8495 144.741 88.1941 156.018 86.3318 163.881C83.7453 175.262 79.9173 183.021 75.3651 192.54V192.643Z" 
                    fill="currentColor"
                  />
                </svg>
              </div>
              <span className="sr-only">Beyler Interactive</span>
            </a>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-xl font-bold">{t("loginTitle")}</h1>
              <FieldDescription>
                {t("dontHaveAccount")} <Link href={signupPath}>{t("signUp")}</Link>
              </FieldDescription>
            </div>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...register("email")}
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending magic link..." : "Send magic link"}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field className="grid gap-4 sm:grid-cols-1">
            {/* <Button variant="outline" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              {t("continueWithApple")}
            </Button> */}
            <Button
              variant="outline"
              type="button"
              disabled={isGoogleRedirecting}
              onClick={handleGoogleLogin}
            >
              <img
                src="/assets/🏢 Company=Google, 🏵️ Style=Original.svg"
                alt="Google"
                width={20}
                height={20}
              />
              {isGoogleRedirecting ? "Redirecting..." : t("continueWithGoogle")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {t.rich("termsAndPrivacy", {
          terms: (chunks) => <a href="#">{chunks}</a>,
          privacy: (chunks) => <a href="#">{chunks}</a>,
        })}
      </FieldDescription>
    </div>
  )
}
