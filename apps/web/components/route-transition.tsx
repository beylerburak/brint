"use client"

import { useEffect, useState } from "react"
import { usePathname, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { IconBrandAsana } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import { EncryptedText } from "@/components/ui/encrypted-text"

export function RouteTransition() {
  const pathname = usePathname()
  const params = useParams()
  const t = useTranslations('transition')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [transitionType, setTransitionType] = useState<'toBrand' | 'toWorkspace' | null>(null)

  useEffect(() => {
    if (pathname !== prevPathname) {
      const segments = pathname.split('/').filter(Boolean)
      const prevSegments = prevPathname.split('/').filter(Boolean)
      
      // Check if transitioning between workspace and brand (or vice versa)
      // Without locale: workspace=2, brand=3
      // With locale: workspace=3, brand=4
      const isBrandTransition = 
        (segments.length === 3 && prevSegments.length === 2) || // workspace → brand (no locale)
        (segments.length === 2 && prevSegments.length === 3) || // brand → workspace (no locale)
        (segments.length === 4 && prevSegments.length === 3) || // workspace → brand (with locale)
        (segments.length === 3 && prevSegments.length === 4)    // brand → workspace (with locale)

      if (isBrandTransition) {
        // Determine transition direction
        const goingToBrand = segments.length > prevSegments.length
        setTransitionType(goingToBrand ? 'toBrand' : 'toWorkspace')
        setIsTransitioning(true)
        
        // Show transition for 2.5 seconds
        setTimeout(() => {
          setIsTransitioning(false)
          setPrevPathname(pathname)
          setTransitionType(null)
        }, 2500)
      } else {
        setPrevPathname(pathname)
      }
    }
  }, [pathname, prevPathname])

  const getBrandSlug = () => {
    const segments = pathname.split('/').filter(Boolean)
    // Brand slug is the 3rd segment (or 4th if locale present)
    return segments[2] || segments[3] || ''
  }

  const getLoadingMessage = () => {
    if (transitionType === 'toBrand') {
      const brandSlug = getBrandSlug()
      return t('loadingBrand', { brand: brandSlug })
    }
    return t('loadingWorkspace')
  }

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          <div className="flex flex-col items-center gap-6">
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.2, 1]
              }}
              transition={{ 
                rotate: { duration: 1.5, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity }
              }}
            >
              <IconBrandAsana className="h-16 w-16 text-primary" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <EncryptedText 
                text={getLoadingMessage()}
                className="text-lg font-medium"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

