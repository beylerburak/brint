"use client";

import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";

interface CaptionEditorExtensionsProps {
  onEmojiSelect: (emoji: string) => void;
  onHashtagClick?: () => void;
  value?: string;
}

/**
 * Caption Editor Extensions
 * 
 * Provides emoji picker and other extensions for caption editing.
 * Designed to be extensible for future additions.
 */
export function CaptionEditorExtensions({
  onEmojiSelect,
  onHashtagClick,
  value = "",
}: CaptionEditorExtensionsProps) {
  const characterCount = value.length;

  return (
    <div className="flex items-center justify-between gap-1 pt-1 mt-1 w-full">
      <div className="flex items-center gap-1">
        {/* Emoji Picker */}
        <EmojiPicker onEmojiSelect={onEmojiSelect} />

        {/* Hashtag Button */}
        {onHashtagClick && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onHashtagClick}
          >
            <Hash className="h-4 w-4" />
          </Button>
        )}

        {/* Future extensions can be added here */}
      </div>

      {/* Character Count */}
      <span className="text-xs text-muted-foreground">
        {characterCount} karakter
      </span>
    </div>
  );
}

