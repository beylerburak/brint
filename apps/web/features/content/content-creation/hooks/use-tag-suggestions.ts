import { useState, useEffect, useCallback } from "react"
import type { TagSuggestion } from "../content-creation.types"

interface UseTagSuggestionsProps {
  currentWorkspaceId?: string
  tags: string[]
  setTags: (tags: string[] | ((prev: string[]) => string[])) => void
  onSearchTags?: (workspaceId: string, options: { query: string; limit: number }) => Promise<{ items: TagSuggestion[] }>
}

export function useTagSuggestions({
  currentWorkspaceId,
  tags,
  setTags,
  onSearchTags,
}: UseTagSuggestionsProps) {
  const [tagSearchQuery, setTagSearchQuery] = useState("")
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  // Load tag suggestions with debounce
  useEffect(() => {
    const loadTagSuggestions = async () => {
      if (!currentWorkspaceId || !tagSearchQuery.trim() || tagSearchQuery.trim().length < 2 || !onSearchTags) {
        setTagSuggestions([])
        setShowTagSuggestions(false)
        return
      }
      
      setIsLoadingTags(true)
      try {
        const response = await onSearchTags(currentWorkspaceId, { query: tagSearchQuery.trim(), limit: 10 })
        setTagSuggestions(response.items)
        setShowTagSuggestions(true)
      } catch (error) {
        console.error('Failed to load tag suggestions:', error)
        setTagSuggestions([])
      } finally {
        setIsLoadingTags(false)
      }
    }
    
    const debounceTimer = setTimeout(loadTagSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [currentWorkspaceId, tagSearchQuery, onSearchTags])

  // Handle tag input change
  const handleTagInputChange = useCallback((value: string) => {
    setTagSearchQuery(value)
  }, [])

  // Handle tag selection from suggestions
  const handleTagSelect = useCallback((tagName: string) => {
    if (!tags.includes(tagName)) {
      setTags([...tags, tagName])
    }
    setTagSearchQuery("")
    setShowTagSuggestions(false)
  }, [tags, setTags])

  // Handle creating new tag
  const handleCreateNewTag = useCallback(() => {
    if (tagSearchQuery.trim() && !tags.includes(tagSearchQuery.trim())) {
      setTags([...tags, tagSearchQuery.trim()])
      setTagSearchQuery("")
      setShowTagSuggestions(false)
    }
  }, [tagSearchQuery, tags, setTags])

  return {
    tagSearchQuery,
    tagSuggestions,
    isLoadingTags,
    showTagSuggestions,
    setShowTagSuggestions,
    handleTagInputChange,
    handleTagSelect,
    handleCreateNewTag,
  }
}

