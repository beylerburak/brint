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
      
      // Known workspace pages that are NOT brand slugs
      const workspacePages = ['brands', 'home', 'settings', 'team', 'analytics', 'projects']
      
      // Determine if current and previous paths are brand pages
      // Brand page: /{locale?}/{workspace}/{brandSlug}/...
      // Workspace page: /{locale?}/{workspace}/{workspacePage}
      
      const hasLocale = ['en', 'tr'].includes(segments[0])
      const thirdSegmentIndex = hasLocale ? 2 : 1
      
      const currentThirdSegment = segments[thirdSegmentIndex]
      const prevThirdSegment = prevSegments[thirdSegmentIndex]
      
      // Check if current path is a brand page (has 4+ segments and third segment is not a workspace page)
      const isCurrentBrandPage = segments.length >= (hasLocale ? 4 : 3) && 
                                  currentThirdSegment && 
                                  !workspacePages.includes(currentThirdSegment)
      
      // Check if previous path is a brand page
      const isPrevBrandPage = prevSegments.length >= (['en', 'tr'].includes(prevSegments[0]) ? 4 : 3) && 
                              prevThirdSegment && 
                              !workspacePages.includes(prevThirdSegment)
      
      // Only transition when crossing workspace ↔ brand boundary (entering brand, not workspace-to-workspace)
      // Transition should only show when going TO a brand page, not between workspace pages
      const isBrandTransition = isCurrentBrandPage && !isPrevBrandPage

      if (isBrandTransition) {
        // Determine transition direction
        setTransitionType('toBrand')
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
    const hasLocale = ['en', 'tr'].includes(segments[0])
    const thirdSegmentIndex = hasLocale ? 2 : 1
    const brandSlug = segments[thirdSegmentIndex]
    
    // Only return if it's not a workspace page
    const workspacePages = ['brands', 'home', 'settings', 'team', 'analytics', 'projects']
    // Brand page should have at least 4 segments (with locale) or 3 segments (without locale)
    const isBrandPage = segments.length >= (hasLocale ? 4 : 3)
    return isBrandPage && brandSlug && !workspacePages.includes(brandSlug) ? brandSlug : ''
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

