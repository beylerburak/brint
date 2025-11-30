"use client";

/**
 * Preview Link Card
 * 
 * Displays a preview image of a link when hovered.
 * Based on Radix UI HoverCard and inspired by Aceternity UI Link Preview.
 */

import * as React from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/utils";

// ============================================================================
// PreviewLinkCard (Root)
// ============================================================================

interface PreviewLinkCardProps extends HoverCard.HoverCardProps {
  children: React.ReactNode;
}

const PreviewLinkCard = ({ children, ...props }: PreviewLinkCardProps) => {
  return (
    <HoverCard.Root openDelay={100} closeDelay={100} {...props}>
      {children}
    </HoverCard.Root>
  );
};

// ============================================================================
// PreviewLinkCardTrigger
// ============================================================================

interface PreviewLinkCardTriggerProps
  extends React.ComponentPropsWithoutRef<typeof HoverCard.Trigger> {
  children: React.ReactNode;
  href?: string;
  className?: string;
}

const PreviewLinkCardTrigger = React.forwardRef<
  HTMLAnchorElement,
  PreviewLinkCardTriggerProps
>(({ children, href, className, ...props }, ref) => {
  return (
    <HoverCard.Trigger asChild {...props}>
      {href ? (
        <a
          ref={ref}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "cursor-pointer text-foreground underline-offset-4 hover:underline",
            className
          )}
        >
          {children}
        </a>
      ) : (
        <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
          {children}
        </span>
      )}
    </HoverCard.Trigger>
  );
});
PreviewLinkCardTrigger.displayName = "PreviewLinkCardTrigger";

// ============================================================================
// PreviewLinkCardContent
// ============================================================================

interface PreviewLinkCardContentProps
  extends React.ComponentPropsWithoutRef<typeof HoverCard.Content> {
  children: React.ReactNode;
  className?: string;
}

const PreviewLinkCardContent = React.forwardRef<
  HTMLDivElement,
  PreviewLinkCardContentProps
>(({ children, className, sideOffset = 10, ...props }, ref) => {
  return (
    <HoverCard.Portal>
      <HoverCard.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn("z-50", className)}
        {...props}
      >
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "w-[300px] overflow-hidden rounded-xl border bg-popover shadow-xl",
              className
            )}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </HoverCard.Content>
    </HoverCard.Portal>
  );
});
PreviewLinkCardContent.displayName = "PreviewLinkCardContent";

// ============================================================================
// PreviewLinkCardImage
// ============================================================================

interface PreviewLinkCardImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

const PreviewLinkCardImage = ({
  src,
  alt = "Link preview",
  className,
  fallback,
  ...props
}: PreviewLinkCardImageProps) => {
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setError(false);
    setLoading(true);
  }, [src]);

  if (error || !src) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex h-[150px] w-full items-center justify-center bg-muted">
        <span className="text-sm text-muted-foreground">No preview available</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-[150px] w-full object-cover transition-opacity",
          loading ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        {...props}
      />
    </div>
  );
};

// ============================================================================
// PreviewLinkCardHeader
// ============================================================================

interface PreviewLinkCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

const PreviewLinkCardHeader = ({
  children,
  className,
}: PreviewLinkCardHeaderProps) => {
  return (
    <div className={cn("p-3", className)}>
      {children}
    </div>
  );
};

// ============================================================================
// PreviewLinkCardTitle
// ============================================================================

interface PreviewLinkCardTitleProps {
  children: React.ReactNode;
  className?: string;
}

const PreviewLinkCardTitle = ({
  children,
  className,
}: PreviewLinkCardTitleProps) => {
  return (
    <h4 className={cn("font-semibold text-sm line-clamp-1", className)}>
      {children}
    </h4>
  );
};

// ============================================================================
// PreviewLinkCardDescription
// ============================================================================

interface PreviewLinkCardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const PreviewLinkCardDescription = ({
  children,
  className,
}: PreviewLinkCardDescriptionProps) => {
  return (
    <p className={cn("text-xs text-muted-foreground line-clamp-2 mt-1", className)}>
      {children}
    </p>
  );
};

// ============================================================================
// Exports
// ============================================================================

export {
  PreviewLinkCard,
  PreviewLinkCardTrigger,
  PreviewLinkCardContent,
  PreviewLinkCardImage,
  PreviewLinkCardHeader,
  PreviewLinkCardTitle,
  PreviewLinkCardDescription,
};

