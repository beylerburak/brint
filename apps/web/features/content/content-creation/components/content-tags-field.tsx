import React from "react"
import { useTranslations } from "next-intl"
import { IconHash, IconX } from "@tabler/icons-react"
import * as TagsInput from "@diceui/tags-input"
import type { TagSuggestion } from "../content-creation.types"

interface ContentTagsFieldProps {
  tags: string[]
  setTags: (tags: string[] | ((prev: string[]) => string[])) => void
  tagSearchQuery: string
  tagSuggestions: TagSuggestion[]
  showTagSuggestions: boolean
  isLoadingTags: boolean
  onTagInputChange: (value: string) => void
  onTagSelect: (tagName: string) => void
  onCreateNewTag: () => void
  onShowTagSuggestionsChange: (show: boolean) => void
}

export const ContentTagsField = React.memo(function ContentTagsField({
  tags,
  setTags,
  tagSearchQuery,
  tagSuggestions,
  showTagSuggestions,
  isLoadingTags,
  onTagInputChange,
  onTagSelect,
  onCreateNewTag,
  onShowTagSuggestionsChange,
}: ContentTagsFieldProps) {
  const t = useTranslations("contentCreation")

  return (
    <div className="space-y-2">
      <TagsInput.Root 
        value={tags} 
        onValueChange={setTags} 
        editable 
        addOnPaste
        className="w-full"
      >
        <TagsInput.Label className="text-sm font-medium flex items-center gap-2 mb-2">
          <IconHash className="h-4 w-4" />
          {t("tags")}
        </TagsInput.Label>
        <div className="relative">
          <div className="flex flex-wrap gap-2 p-2 min-h-[42px] border border-border rounded-md bg-background">
            {tags.map((tag) => (
              <TagsInput.Item 
                key={tag} 
                value={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
              >
                <TagsInput.ItemText>{tag}</TagsInput.ItemText>
                <TagsInput.ItemDelete className="ml-1 cursor-pointer hover:text-destructive inline-flex items-center justify-center">
                  <IconX className="h-3 w-3" />
                </TagsInput.ItemDelete>
              </TagsInput.Item>
            ))}
            <TagsInput.Input 
              placeholder={t("addTagPlaceholder")}
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
              value={tagSearchQuery}
              onChange={(e) => onTagInputChange(e.target.value)}
              onFocus={() => {
                if (tagSearchQuery.trim().length >= 2) {
                  onShowTagSuggestionsChange(true)
                }
              }}
              onBlur={() => {
                setTimeout(() => onShowTagSuggestionsChange(false), 200)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagSearchQuery.trim() && !tags.includes(tagSearchQuery.trim())) {
                  e.preventDefault()
                  onCreateNewTag()
                }
              }}
            />
          </div>
          {/* Autocomplete suggestions */}
          {showTagSuggestions && (tagSuggestions.length > 0 || tagSearchQuery.trim().length >= 2) && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-auto">
              {isLoadingTags ? (
                <div className="p-2 text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  {tagSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                      onClick={() => onTagSelect(suggestion.name)}
                    >
                      <IconHash className="h-3 w-3 text-muted-foreground" />
                      <span>{suggestion.name}</span>
                    </button>
                  ))}
                  {tagSearchQuery.trim().length >= 2 && 
                   !tagSuggestions.some(s => s.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) &&
                   !tags.includes(tagSearchQuery.trim()) && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-primary"
                      onClick={onCreateNewTag}
                    >
                      <IconHash className="h-3 w-3" />
                      <span>{t("createTag", { tag: tagSearchQuery.trim() })}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </TagsInput.Root>
    </div>
  )
})

