"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeToggler } from "@/components/animate-ui/primitives/effects/theme-toggler";
import { motion } from "motion/react";

export function AnimatedThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative h-8 w-14 rounded-full bg-muted">
        <div className="absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
      </div>
    );
  }

  const currentTheme = (theme as "light" | "dark" | "system") || "system";
  const currentResolved = (resolvedTheme as "light" | "dark") || "light";

  const isDark = currentResolved === "dark";

  return (
    <ThemeToggler
      theme={currentTheme}
      resolvedTheme={currentResolved}
      setTheme={setTheme}
      direction="ltr"
    >
      {({ resolved, toggleTheme }) => {
        const isDarkMode = resolved === "dark";
        
        return (
          <button
            onClick={() => {
              const nextTheme = isDarkMode ? "light" : "dark";
              toggleTheme(nextTheme);
            }}
            className="relative h-8 w-14 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{
              backgroundColor: isDarkMode ? "#000000" : "#e5e7eb",
              border: isDarkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #d1d5db",
            }}
            aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
          >
            {/* Thumb - moves left to right */}
            <motion.div
              className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white flex items-center justify-center shadow-sm"
              initial={false}
              animate={{
                left: isDarkMode ? "calc(100% - 1.5rem - 0.25rem)" : "0.25rem",
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
            >
              {/* Sun icon inside thumb (visible in dark mode) */}
              {isDarkMode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Sun className="h-3.5 w-3.5 text-gray-600" />
                </motion.div>
              )}
            </motion.div>

            {/* Sun icon on left side (visible in dark mode) */}
            {isDarkMode && (
              <motion.div
                className="absolute left-1.5 top-1/2 -translate-y-1/2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Sun className="h-4 w-4 text-gray-400" />
              </motion.div>
            )}

            {/* Moon icon on right side (visible in light mode) */}
            {!isDarkMode && (
              <motion.div
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Moon className="h-4 w-4 text-gray-600" />
              </motion.div>
            )}

            {/* Empty black circle on right (visible in dark mode) */}
            {isDarkMode && (
              <motion.div
                className="absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-gray-800 bg-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            )}
          </button>
        );
      }}
    </ThemeToggler>
  );
}

