"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useWorkspace } from "@/contexts/workspace-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTranslations } from "next-intl"
import { motion, PanInfo } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsList,
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger,
  TabsContents,
  TabsContent
} from "@/components/animate-ui/primitives/animate/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IconPencil, IconExternalLink, IconPhone, IconMail, IconSparkles, IconPlus, IconCheck, IconX, IconUpload, IconLayoutDashboard, IconUsers, IconMessageCircle, IconShieldCheck, IconPalette, IconBriefcase, IconMapPin, IconBrandWhatsapp, IconWorld, IconTrash, IconGripVertical, IconInfoCircle, IconClock, IconChevronDown, IconSearch } from "@tabler/icons-react"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import Cropper, { Area } from "react-easy-crop"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import type {
  BrandDetailDto,
  BrandProfileData,
  BrandContactChannelDto,
  BrandContactType,
  CreateBrandContactChannelInput
} from "@/lib/brand-types"
import { formatDateShort, formatTimeShort, DateFormat, TimeFormat } from "@/lib/datetime"
import {
  ColorPicker,
  ColorPickerContent,
  ColorPickerTrigger,
  ColorPickerSwatch,
  ColorPickerArea,
  ColorPickerHueSlider,
  ColorPickerInput,
} from "@/components/ui/color-picker"
import { MAX_AVATAR_SIZE_MB, MAX_AVATAR_SIZE_BYTES } from "@brint/shared-config/upload"

// Country codes for phone input
const countryCodes = [
  { code: '+90', country: 'TR', flag: '🇹🇷', name: 'Turkey' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', country: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: '+48', country: 'PL', flag: '🇵🇱', name: 'Poland' },
  { code: '+7', country: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
]

// Languages for locale selection
const languages = [
  { code: 'en-US', flag: '🇺🇸', name: 'English (US)' },
  { code: 'en-GB', flag: '🇬🇧', name: 'English (UK)' },
  { code: 'tr-TR', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'de-DE', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr-FR', flag: '🇫🇷', name: 'Français' },
  { code: 'es-ES', flag: '🇪🇸', name: 'Español' },
  { code: 'it-IT', flag: '🇮🇹', name: 'Italiano' },
  { code: 'pt-BR', flag: '🇧🇷', name: 'Português (BR)' },
  { code: 'ru-RU', flag: '🇷🇺', name: 'Русский' },
  { code: 'ja-JP', flag: '🇯🇵', name: '日本語' },
  { code: 'zh-CN', flag: '🇨🇳', name: '中文' },
  { code: 'ko-KR', flag: '🇰🇷', name: '한국어' },
  { code: 'ar-SA', flag: '🇸🇦', name: 'العربية' },
  { code: 'nl-NL', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'pl-PL', flag: '🇵🇱', name: 'Polski' },
]

// Timezones
const timezones = [
  { value: 'Europe/Istanbul', label: 'Istanbul (GMT+3)', region: 'Europe' },
  { value: 'Europe/London', label: 'London (GMT+0)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow (GMT+3)', region: 'Europe' },
  { value: 'America/New_York', label: 'New York (GMT-5)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto (GMT-5)', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City (GMT-6)', region: 'Americas' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Mumbai/Kolkata (GMT+5:30)', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10)', region: 'Pacific' },
  { value: 'Pacific/Auckland', label: 'Auckland (GMT+12)', region: 'Pacific' },
]

// Industries
const industries = [
  'Technology',
  'Software & SaaS',
  'E-commerce',
  'Retail',
  'Financial Services',
  'Banking',
  'Insurance',
  'Healthcare',
  'Pharmaceuticals',
  'Biotechnology',
  'Education',
  'E-learning',
  'Marketing & Advertising',
  'Digital Marketing',
  'Public Relations',
  'Media & Entertainment',
  'Publishing',
  'Gaming',
  'Music',
  'Film & Video',
  'Real Estate',
  'Construction',
  'Architecture',
  'Manufacturing',
  'Automotive',
  'Aerospace',
  'Food & Beverage',
  'Restaurant',
  'Hospitality',
  'Travel & Tourism',
  'Transportation',
  'Logistics',
  'Energy',
  'Telecommunications',
  'Consulting',
  'Legal Services',
  'Accounting',
  'Human Resources',
  'Recruitment',
  'Non-profit',
  'Government',
  'Agriculture',
  'Fashion',
  'Beauty & Cosmetics',
  'Sports & Fitness',
  'Wellness',
  'Home Services',
  'Security',
  'Environmental Services',
]

// Countries
const countriesData = [
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
]

// Age options for persona
const ageOptions = Array.from({ length: 68 }, (_, i) => (i + 13).toString()) // 13 to 80

// Cities by country
const citiesByCountry: Record<string, string[]> = {
  TR: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya'],
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Francisco', 'Seattle', 'Boston', 'Miami', 'Atlanta', 'Denver'],
  GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Dusseldorf', 'Dortmund'],
  FR: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux'],
  IT: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venice', 'Bologna', 'Genoa'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Malaga', 'Bilbao'],
  NL: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen'],
  BE: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liege', 'Namur'],
  CH: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lucerne'],
  AT: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  PL: ['Warsaw', 'Krakow', 'Wroclaw', 'Poznan', 'Gdansk', 'Lodz'],
  SE: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala', 'Linkoping'],
  NO: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen'],
  DK: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'],
  FI: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu'],
  RU: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan'],
  CN: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan'],
  JP: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'],
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'],
  BR: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte'],
  MX: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancun'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
  SA: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
  CA: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton'],
  SG: ['Singapore'],
  HK: ['Hong Kong'],
  TH: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi'],
}

// Phone mask helper
const formatPhoneNumber = (value: string, countryCode: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '')

  // Turkey format: 5XX XXX XX XX
  if (countryCode === '+90') {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  }

  // US format: (XXX) XXX-XXXX
  if (countryCode === '+1') {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // Generic format: XXX XXX XXXX
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
}

// Email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Website URL formatting
const formatWebsiteUrl = (url: string): string => {
  if (!url) return ''
  // Remove existing protocol if any
  let cleaned = url.replace(/^https?:\/\//, '').replace(/^www\./, '')
  return cleaned
}

// Contact type icon mapping
const contactTypeIcons: Record<BrandContactType, React.ElementType> = {
  PHONE: IconPhone,
  WHATSAPP: IconBrandWhatsapp,
  EMAIL: IconMail,
  ADDRESS: IconMapPin,
  WEBSITE: IconWorld,
}

const contactTypeLabels: Record<BrandContactType, string> = {
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  ADDRESS: 'Address',
  WEBSITE: 'Website',
}

export default function BrandProfilePage() {
  const t = useTranslations()
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace, user } = useWorkspace()
  const isMobile = useIsMobile()
  const [brand, setBrand] = useState<BrandDetailDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Contact channels state
  const [contactChannels, setContactChannels] = useState<BrandContactChannelDto[]>([])
  const [showAddContactDialog, setShowAddContactDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<BrandContactChannelDto | null>(null)
  const [contactForm, setContactForm] = useState<CreateBrandContactChannelInput & { countryCode?: string; phoneNumber?: string }>({
    type: 'PHONE',
    label: '',
    value: '',
    isPrimary: false,
    countryCode: '+90',
    phoneNumber: '',
  })
  const [isContactSaving, setIsContactSaving] = useState(false)
  const [contactEmailError, setContactEmailError] = useState<string | null>(null)

  // Profile edit state
  const [isProfileSaving, setIsProfileSaving] = useState(false)

  // Edit dialog states
  const [showIdentityDialog, setShowIdentityDialog] = useState(false)
  const [identityForm, setIdentityForm] = useState({ tagline: '', mission: '', vision: '' })

  const [showQuickFactsDialog, setShowQuickFactsDialog] = useState(false)
  const [showQuickFactsInfo, setShowQuickFactsInfo] = useState(false)
  const [showIdentityInfo, setShowIdentityInfo] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [timezoneOpen, setTimezoneOpen] = useState(false)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [quickFactsForm, setQuickFactsForm] = useState({
    primaryLocale: '',
    timezone: '',
    industry: '',
    workingHoursDetail: {
      monday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      tuesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      wednesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      thursday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      friday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      saturday: { isOpen: false, startTime: '', endTime: '' },
      sunday: { isOpen: false, startTime: '', endTime: '' },
    },
  })

  const [showBusinessOverviewDialog, setShowBusinessOverviewDialog] = useState(false)
  const [businessOverviewForm, setBusinessOverviewForm] = useState({
    businessType: '' as 'Service' | 'Product' | 'Both' | '',
    marketType: '' as 'B2B' | 'B2C' | 'B2B2C' | '',
    deliveryModel: '',
  })

  const [showCoreOfferingsDialog, setShowCoreOfferingsDialog] = useState(false)
  const [coreOfferingsForm, setCoreOfferingsForm] = useState({
    coreServices: [] as string[],
    coreProducts: [] as string[],
    newService: '',
    newProduct: '',
  })

  const [showSalesChannelsDialog, setShowSalesChannelsDialog] = useState(false)
  const [salesChannelsForm, setSalesChannelsForm] = useState({
    salesChannels: [] as string[],
    transactionTypes: [] as string[],
    newChannel: '',
    newType: '',
  })

  const [showServiceRegionsDialog, setShowServiceRegionsDialog] = useState(false)
  const [serviceRegionsForm, setServiceRegionsForm] = useState({
    structureType: '' as 'Single-location' | 'Multi-branch' | 'Franchise' | 'Online-only' | '',
    hqCountry: '',
    hqCity: '',
    serviceRegions: [] as string[],
    newRegion: '',
  })
  const [countries, setCountries] = useState<Array<{ code: string; name: string; flag: string }>>([])
  const [cities, setCities] = useState<string[]>([])
  const [countryOpen, setCountryOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [isLoadingCities, setIsLoadingCities] = useState(false)

  // Business dialog info states
  const [showBusinessOverviewInfo, setShowBusinessOverviewInfo] = useState(false)
  const [showCoreOfferingsInfo, setShowCoreOfferingsInfo] = useState(false)
  const [showSalesChannelsInfo, setShowSalesChannelsInfo] = useState(false)
  const [showServiceRegionsInfo, setShowServiceRegionsInfo] = useState(false)

  // Audience edit states
  const [showPersonaDialog, setShowPersonaDialog] = useState(false)
  const [showPersonaInfo, setShowPersonaInfo] = useState(false)
  const [editingPersona, setEditingPersona] = useState<string | null>(null)
  const [personaForm, setPersonaForm] = useState({
    name: '',
    description: '',
    ageStart: '',
    ageEnd: '',
    painPoints: [] as string[],
    newPainPoint: '',
  })

  const [showPositioningDialog, setShowPositioningDialog] = useState(false)
  const [showPositioningInfo, setShowPositioningInfo] = useState(false)
  const [positioningForm, setPositioningForm] = useState({
    category: '',
    usps: [] as string[],
    newUsp: '',
  })

  const [showCompetitorDialog, setShowCompetitorDialog] = useState(false)
  const [showCompetitorInfo, setShowCompetitorInfo] = useState(false)
  const [editingCompetitor, setEditingCompetitor] = useState<string | null>(null)
  const [competitorForm, setCompetitorForm] = useState({
    name: '',
    note: '',
  })

  // Voice edit states
  const [showToneDialog, setShowToneDialog] = useState(false)
  const [showToneInfo, setShowToneInfo] = useState(false)
  const [toneForm, setToneForm] = useState({
    formalInformal: 0.5,
    seriousPlayful: 0.5,
    simpleComplex: 0.5,
    warmNeutral: 0.5,
  })

  const [showDoSayDialog, setShowDoSayDialog] = useState(false)
  const [showDoSayInfo, setShowDoSayInfo] = useState(false)
  const [doSayForm, setDoSayForm] = useState({
    doSay: [] as string[],
    newPhrase: '',
  })

  const [showDontSayDialog, setShowDontSayDialog] = useState(false)
  const [showDontSayInfo, setShowDontSayInfo] = useState(false)
  const [dontSayForm, setDontSayForm] = useState({
    dontSay: [] as string[],
    newPhrase: '',
  })

  // Rules edit states
  const [showAllowedTopicsDialog, setShowAllowedTopicsDialog] = useState(false)
  const [showAllowedTopicsInfo, setShowAllowedTopicsInfo] = useState(false)
  const [allowedTopicsForm, setAllowedTopicsForm] = useState({
    topics: [] as string[],
    newTopic: '',
  })

  const [showForbiddenTopicsDialog, setShowForbiddenTopicsDialog] = useState(false)
  const [showForbiddenTopicsInfo, setShowForbiddenTopicsInfo] = useState(false)
  const [forbiddenTopicsForm, setForbiddenTopicsForm] = useState({
    topics: [] as string[],
    newTopic: '',
    crisisGuidelines: [] as string[],
    newGuideline: '',
  })

  const [showLegalConstraintDialog, setShowLegalConstraintDialog] = useState(false)
  const [showLegalConstraintInfo, setShowLegalConstraintInfo] = useState(false)
  const [editingLegalConstraint, setEditingLegalConstraint] = useState<string | null>(null)
  const [legalConstraintForm, setLegalConstraintForm] = useState({
    title: '',
    description: '',
  })

  // Assets edit states
  const [showBrandColorsDialog, setShowBrandColorsDialog] = useState(false)
  const [showBrandColorsInfo, setShowBrandColorsInfo] = useState(false)
  const [brandColorsForm, setBrandColorsForm] = useState({
    primary: [] as string[],
    accent: [] as string[],
    newPrimary: '#3b82f6',
    newAccent: '#10b981',
  })

  const [showVisualGuidelinesDialog, setShowVisualGuidelinesDialog] = useState(false)
  const [showVisualGuidelinesInfo, setShowVisualGuidelinesInfo] = useState(false)
  const [visualGuidelinesForm, setVisualGuidelinesForm] = useState({
    guidelines: [] as string[],
    newGuideline: '',
  })

  const [showAiConfigDialog, setShowAiConfigDialog] = useState(false)
  const [showAiConfigInfo, setShowAiConfigInfo] = useState(false)
  const [aiConfigForm, setAiConfigForm] = useState({
    defaultLanguage: '',
    contentLengthMin: '',
    contentLengthMax: '',
    contentLengthUnit: 'chars' as 'chars' | 'words',
    ctaStyle: '',
    preferredPlatforms: [] as string[],
    newPlatform: '',
  })

  // Avatar upload states
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [progressValue, setProgressValue] = useState(0)
  const [isRefreshingScore, setIsRefreshingScore] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tab order for swipe navigation
  const tabOrder = ["overview", "business", "audience", "voice", "rules", "assets"]

  const handleSwipe = (direction: 'left' | 'right') => {
    const currentIndex = tabOrder.indexOf(activeTab)
    if (direction === 'left' && currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
    } else if (direction === 'right' && currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1])
    }
  }

  // Derived profile data from API
  const profile = brand?.profile?.data ?? {} as BrandProfileData
  const optimizationScore = brand?.profile?.optimizationScore ?? null
  const optimizationScoreUpdatedAt = brand?.profile?.optimizationScoreUpdatedAt

  // Profile sections
  const identity = profile.identity ?? {}
  const quickFacts = profile.quickFacts ?? {}
  const businessProfile = profile.business ?? {}
  const audience = profile.audience ?? {}
  const voice = profile.voice ?? {}
  const rules = profile.rules ?? {}
  const assets = profile.assets ?? {}
  const aiConfig = profile.aiConfig ?? {}

  // Load brand with profile and contact channels
  useEffect(() => {
    const loadBrand = async () => {
      if (!currentWorkspace?.id || !brandSlug) return

      setIsLoading(true)
      try {
        // First get brand list to find brand ID by slug
        const listResponse = await apiClient.listBrands(currentWorkspace.id)
        const foundBrandBasic = listResponse.brands.find((b) => b.slug === brandSlug)

        if (!foundBrandBasic) {
          console.error('Brand not found')
          setIsLoading(false)
          return
        }

        // Then get full brand details with profile and contacts
        const detailResponse = await apiClient.getBrand(currentWorkspace.id, foundBrandBasic.id)
        if (detailResponse.success) {
          setBrand(detailResponse.brand)
          setContactChannels(detailResponse.brand.contactChannels ?? [])
        }
      } catch (error) {
        console.error('Failed to load brand:', error)
        toast.error('Failed to load brand details')
      } finally {
        setIsLoading(false)
      }
    }

    loadBrand()
  }, [currentWorkspace?.id, brandSlug])

  // Animate progress value on mount (using optimization score)
  useEffect(() => {
    const timer = setTimeout(() => {
      setProgressValue(optimizationScore ?? 0)
    }, 300)
    return () => clearTimeout(timer)
  }, [optimizationScore])

  // Refresh optimization score handler
  const handleRefreshOptimizationScore = async () => {
    if (!currentWorkspace?.id || !brand?.id) return

    setIsRefreshingScore(true)
    try {
      const response = await apiClient.refreshBrandOptimizationScore(
        currentWorkspace.id,
        brand.id
      )

      // Update local state with new score
      setBrand(prev => prev ? {
        ...prev,
        profile: prev.profile ? {
          ...prev.profile,
          optimizationScore: response.optimizationScore.score,
          optimizationScoreUpdatedAt: new Date().toISOString(),
        } : null
      } : null)

      toast.success(`Optimization score updated: ${response.optimizationScore.score}%`)
    } catch (error) {
      console.error('Failed to refresh optimization score:', error)
      toast.error('Failed to refresh optimization score')
    } finally {
      setIsRefreshingScore(false)
    }
  }

  // Contact Channel CRUD handlers
  const handleAddContact = () => {
    setEditingContact(null)
    setContactForm({
      type: 'PHONE',
      label: '',
      value: '',
      isPrimary: false,
      countryCode: '+90',
      phoneNumber: '',
    })
    setContactEmailError(null)
    setShowAddContactDialog(true)
  }

  const handleEditContact = (contact: BrandContactChannelDto) => {
    setEditingContact(contact)

    // Parse phone number if type is PHONE or WHATSAPP
    let countryCode = '+90'
    let phoneNumber = contact.value

    if (contact.type === 'PHONE' || contact.type === 'WHATSAPP') {
      // Try to extract country code
      const foundCode = countryCodes.find(c => contact.value.startsWith(c.code))
      if (foundCode) {
        countryCode = foundCode.code
        phoneNumber = contact.value.slice(foundCode.code.length).trim()
      }
    }

    // For website, remove https://
    let value = contact.value
    if (contact.type === 'WEBSITE') {
      value = formatWebsiteUrl(contact.value)
    }

    setContactForm({
      type: contact.type,
      label: contact.label ?? '',
      value: value,
      isPrimary: contact.isPrimary,
      countryCode,
      phoneNumber,
    })
    setContactEmailError(null)
    setShowAddContactDialog(true)
  }

  const handleContactTypeChange = (type: BrandContactType) => {
    setContactForm(prev => ({
      ...prev,
      type,
      value: '',
      phoneNumber: '',
    }))
    setContactEmailError(null)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    const formatted = formatPhoneNumber(raw, contactForm.countryCode || '+90')
    setContactForm(prev => ({ ...prev, phoneNumber: formatted }))
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setContactForm(prev => ({ ...prev, value }))
    if (value && !isValidEmail(value)) {
      setContactEmailError('Please enter a valid email address')
    } else {
      setContactEmailError(null)
    }
  }

  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatWebsiteUrl(e.target.value)
    setContactForm(prev => ({ ...prev, value }))
  }

  const getContactSubmitValue = (): string => {
    if (contactForm.type === 'PHONE' || contactForm.type === 'WHATSAPP') {
      const digits = (contactForm.phoneNumber || '').replace(/\D/g, '')
      return `${contactForm.countryCode} ${digits}`
    }
    if (contactForm.type === 'WEBSITE') {
      return contactForm.value ? `https://${contactForm.value}` : ''
    }
    return contactForm.value
  }

  const isContactFormValid = (): boolean => {
    if (contactForm.type === 'PHONE' || contactForm.type === 'WHATSAPP') {
      const digits = (contactForm.phoneNumber || '').replace(/\D/g, '')
      return digits.length >= 7
    }
    if (contactForm.type === 'EMAIL') {
      return isValidEmail(contactForm.value)
    }
    if (contactForm.type === 'WEBSITE') {
      return contactForm.value.length > 0
    }
    return contactForm.value.trim().length > 0
  }

  const handleSaveContact = async () => {
    if (!currentWorkspace?.id || !brand?.id) return
    if (!isContactFormValid()) return

    setIsContactSaving(true)
    try {
      const submitData: CreateBrandContactChannelInput = {
        type: contactForm.type,
        label: contactForm.label || null,
        value: getContactSubmitValue(),
        isPrimary: contactForm.isPrimary,
      }

      if (editingContact) {
        // Update existing
        const response = await apiClient.updateBrandContactChannel(
          currentWorkspace.id,
          brand.id,
          editingContact.id,
          submitData
        )
        setContactChannels(prev =>
          prev.map(ch => ch.id === editingContact.id ? response.contactChannel : ch)
        )
        toast.success('Contact channel updated')
      } else {
        // Create new
        const response = await apiClient.createBrandContactChannel(
          currentWorkspace.id,
          brand.id,
          submitData
        )
        setContactChannels(prev => [...prev, response.contactChannel])
        toast.success('Contact channel added')
      }
      setShowAddContactDialog(false)
    } catch (error) {
      console.error('Failed to save contact:', error)
      toast.error('Failed to save contact channel')
    } finally {
      setIsContactSaving(false)
    }
  }

  const handleDeleteContact = async (channelId: string) => {
    if (!currentWorkspace?.id || !brand?.id) return

    try {
      await apiClient.deleteBrandContactChannel(currentWorkspace.id, brand.id, channelId)
      setContactChannels(prev => prev.filter(ch => ch.id !== channelId))
      toast.success('Contact channel deleted')
    } catch (error) {
      console.error('Failed to delete contact:', error)
      toast.error('Failed to delete contact channel')
    }
  }

  // Profile save handler
  const handleSaveProfile = async (updatedProfile: BrandProfileData) => {
    if (!currentWorkspace?.id || !brand?.id) return

    setIsProfileSaving(true)
    try {
      const response = await apiClient.updateBrandProfile(
        currentWorkspace.id,
        brand.id,
        {
          profileData: updatedProfile,
          optimizationScore: brand.profile?.optimizationScore,
        }
      )

      // Update local state
      setBrand(prev => prev ? {
        ...prev,
        profile: response.profile
      } : null)

      toast.success('Brand profile updated successfully')
      return true
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('Failed to update brand profile')
      return false
    } finally {
      setIsProfileSaving(false)
    }
  }

  // Identity Edit handlers
  const handleOpenIdentityDialog = () => {
    setIdentityForm({
      tagline: identity.tagline || brand?.description || '',
      mission: identity.mission || '',
      vision: identity.vision || '',
    })
    setShowIdentityDialog(true)
  }

  const handleSaveIdentity = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      identity: {
        ...identity,
        tagline: identityForm.tagline || null,
        mission: identityForm.mission || null,
        vision: identityForm.vision || null,
      },
    }
    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowIdentityDialog(false)
    }
  }

  // Generate working hours summary
  const generateWorkingHoursSummary = (detail: {
    monday?: { isOpen: boolean; startTime: string; endTime: string };
    tuesday?: { isOpen: boolean; startTime: string; endTime: string };
    wednesday?: { isOpen: boolean; startTime: string; endTime: string };
    thursday?: { isOpen: boolean; startTime: string; endTime: string };
    friday?: { isOpen: boolean; startTime: string; endTime: string };
    saturday?: { isOpen: boolean; startTime: string; endTime: string };
    sunday?: { isOpen: boolean; startTime: string; endTime: string };
  }): string => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    // Group consecutive days with same hours
    const groups: { days: string[]; hours: string }[] = []
    let currentGroup: { days: string[]; hours: string } | null = null

    days.forEach((day, idx) => {
      const dayData = detail[day]
      if (dayData?.isOpen && dayData.startTime && dayData.endTime) {
        const hours = `${dayData.startTime}-${dayData.endTime}`
        if (!currentGroup || currentGroup.hours !== hours) {
          currentGroup = { days: [dayNames[idx]], hours }
          groups.push(currentGroup)
        } else {
          currentGroup.days.push(dayNames[idx])
        }
      } else {
        currentGroup = null
      }
    })

    // Format groups
    return groups.map(group => {
      const daysStr = group.days.length > 1
        ? `${group.days[0]}-${group.days[group.days.length - 1]}`
        : group.days[0]
      return `${daysStr} ${group.hours}`
    }).join(', ') || 'Closed'
  }

  // Quick Facts Edit handlers
  const handleOpenQuickFactsDialog = () => {
    const defaultHours = {
      monday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      tuesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      wednesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      thursday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      friday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      saturday: { isOpen: false, startTime: '', endTime: '' },
      sunday: { isOpen: false, startTime: '', endTime: '' },
    }

    setQuickFactsForm({
      primaryLocale: brand?.primaryLocale || '',
      timezone: brand?.timezone || '',
      industry: brand?.industry || '',
      workingHoursDetail: {
        monday: quickFacts.workingHoursDetail?.monday || defaultHours.monday,
        tuesday: quickFacts.workingHoursDetail?.tuesday || defaultHours.tuesday,
        wednesday: quickFacts.workingHoursDetail?.wednesday || defaultHours.wednesday,
        thursday: quickFacts.workingHoursDetail?.thursday || defaultHours.thursday,
        friday: quickFacts.workingHoursDetail?.friday || defaultHours.friday,
        saturday: quickFacts.workingHoursDetail?.saturday || defaultHours.saturday,
        sunday: quickFacts.workingHoursDetail?.sunday || defaultHours.sunday,
      },
    })
    setLanguageOpen(false)
    setTimezoneOpen(false)
    setIndustryOpen(false)
    setShowQuickFactsDialog(true)
  }

  const handleSaveQuickFacts = async () => {
    if (!currentWorkspace?.id || !brand?.id) return

    setIsProfileSaving(true)
    try {
      // Update brand basic info (timezone, locale, industry)
      if (quickFactsForm.primaryLocale !== brand.primaryLocale ||
        quickFactsForm.timezone !== brand.timezone ||
        quickFactsForm.industry !== brand.industry) {
        await apiClient.updateBrand(currentWorkspace.id, brand.id, {
          primaryLocale: quickFactsForm.primaryLocale || null,
          timezone: quickFactsForm.timezone || null,
          industry: quickFactsForm.industry || null,
        })
      }

      // Generate summary
      const summary = generateWorkingHoursSummary(quickFactsForm.workingHoursDetail)

      // Update profile
      const updatedProfile: BrandProfileData = {
        ...profile,
        quickFacts: {
          ...quickFacts,
          workingHours: summary,
          workingHoursDetail: quickFactsForm.workingHoursDetail,
        },
      }

      const response = await apiClient.updateBrandProfile(
        currentWorkspace.id,
        brand.id,
        {
          profileData: updatedProfile,
          optimizationScore: brand.profile?.optimizationScore,
        }
      )

      // Update local state
      setBrand(prev => prev ? {
        ...prev,
        primaryLocale: quickFactsForm.primaryLocale || null,
        timezone: quickFactsForm.timezone || null,
        industry: quickFactsForm.industry || null,
        profile: response.profile,
      } : null)

      toast.success('Quick Facts updated successfully')
      setShowQuickFactsDialog(false)
    } catch (error) {
      console.error('Failed to save quick facts:', error)
      toast.error('Failed to update quick facts')
    } finally {
      setIsProfileSaving(false)
    }
  }

  // Business Overview Edit handlers
  const handleOpenBusinessOverviewDialog = () => {
    setBusinessOverviewForm({
      businessType: businessProfile.businessType || '',
      marketType: businessProfile.marketType || '',
      deliveryModel: businessProfile.deliveryModel || '',
    })
    setShowBusinessOverviewDialog(true)
  }

  const handleSaveBusinessOverview = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      business: {
        ...businessProfile,
        businessType: businessOverviewForm.businessType || undefined,
        marketType: businessOverviewForm.marketType || undefined,
        deliveryModel: businessOverviewForm.deliveryModel || undefined,
      },
    }
    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowBusinessOverviewDialog(false)
    }
  }

  // Core Offerings Edit handlers
  const handleOpenCoreOfferingsDialog = () => {
    setCoreOfferingsForm({
      coreServices: [...(businessProfile.coreServices || [])],
      coreProducts: [...(businessProfile.coreProducts || [])],
      newService: '',
      newProduct: '',
    })
    setShowCoreOfferingsDialog(true)
  }

  const handleAddService = () => {
    if (coreOfferingsForm.newService.trim()) {
      setCoreOfferingsForm(prev => ({
        ...prev,
        coreServices: [...prev.coreServices, prev.newService.trim()],
        newService: '',
      }))
    }
  }

  const handleRemoveService = (index: number) => {
    setCoreOfferingsForm(prev => ({
      ...prev,
      coreServices: prev.coreServices.filter((_, i) => i !== index),
    }))
  }

  const handleAddProduct = () => {
    if (coreOfferingsForm.newProduct.trim()) {
      setCoreOfferingsForm(prev => ({
        ...prev,
        coreProducts: [...prev.coreProducts, prev.newProduct.trim()],
        newProduct: '',
      }))
    }
  }

  const handleRemoveProduct = (index: number) => {
    setCoreOfferingsForm(prev => ({
      ...prev,
      coreProducts: prev.coreProducts.filter((_, i) => i !== index),
    }))
  }

  const handleSaveCoreOfferings = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      business: {
        ...businessProfile,
        coreServices: coreOfferingsForm.coreServices,
        coreProducts: coreOfferingsForm.coreProducts,
      },
    }
    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowCoreOfferingsDialog(false)
    }
  }

  // Sales Channels Edit handlers
  const handleOpenSalesChannelsDialog = () => {
    setSalesChannelsForm({
      salesChannels: [...(businessProfile.salesChannels || [])],
      transactionTypes: [...(businessProfile.transactionTypes || [])],
      newChannel: '',
      newType: '',
    })
    setShowSalesChannelsDialog(true)
  }

  const handleAddSalesChannel = () => {
    if (salesChannelsForm.newChannel.trim()) {
      setSalesChannelsForm(prev => ({
        ...prev,
        salesChannels: [...prev.salesChannels, prev.newChannel.trim()],
        newChannel: '',
      }))
    }
  }

  const handleRemoveSalesChannel = (index: number) => {
    setSalesChannelsForm(prev => ({
      ...prev,
      salesChannels: prev.salesChannels.filter((_, i) => i !== index),
    }))
  }

  const handleAddTransactionType = () => {
    if (salesChannelsForm.newType.trim()) {
      setSalesChannelsForm(prev => ({
        ...prev,
        transactionTypes: [...prev.transactionTypes, prev.newType.trim()],
        newType: '',
      }))
    }
  }

  const handleRemoveTransactionType = (index: number) => {
    setSalesChannelsForm(prev => ({
      ...prev,
      transactionTypes: prev.transactionTypes.filter((_, i) => i !== index),
    }))
  }

  const handleSaveSalesChannels = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      business: {
        ...businessProfile,
        salesChannels: salesChannelsForm.salesChannels,
        transactionTypes: salesChannelsForm.transactionTypes,
      },
    }
    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowSalesChannelsDialog(false)
    }
  }

  // Service Regions Edit handlers
  const handleOpenServiceRegionsDialog = () => {
    // Parse existing hqLocation (e.g., "Istanbul, TR")
    const hqParts = (businessProfile.hqLocation || '').split(', ')
    const hqCity = hqParts[0] || ''
    const hqCountry = hqParts[1] || ''

    setServiceRegionsForm({
      structureType: businessProfile.structureType || '',
      hqCountry,
      hqCity,
      serviceRegions: [...(businessProfile.serviceRegions || [])],
      newRegion: '',
    })

    // Load cities if country is selected
    if (hqCountry) {
      setCities(citiesByCountry[hqCountry] || [])
    } else {
      setCities([])
    }

    setCountryOpen(false)
    setCityOpen(false)
    setShowServiceRegionsDialog(true)
  }

  const handleCountryChange = (countryCode: string) => {
    setServiceRegionsForm(prev => ({
      ...prev,
      hqCountry: countryCode,
      hqCity: '', // Reset city when country changes
    }))
    setCities(citiesByCountry[countryCode] || [])
    setCountryOpen(false)
  }

  const handleAddServiceRegion = () => {
    if (serviceRegionsForm.newRegion.trim()) {
      setServiceRegionsForm(prev => ({
        ...prev,
        serviceRegions: [...prev.serviceRegions, prev.newRegion.trim()],
        newRegion: '',
      }))
    }
  }

  const handleRemoveServiceRegion = (index: number) => {
    setServiceRegionsForm(prev => ({
      ...prev,
      serviceRegions: prev.serviceRegions.filter((_, i) => i !== index),
    }))
  }

  const handleSaveServiceRegions = async () => {
    // Build hqLocation string: "City, CountryCode"
    const hqLocation = serviceRegionsForm.hqCity && serviceRegionsForm.hqCountry
      ? `${serviceRegionsForm.hqCity}, ${serviceRegionsForm.hqCountry}`
      : null

    const updatedProfile: BrandProfileData = {
      ...profile,
      business: {
        ...businessProfile,
        structureType: serviceRegionsForm.structureType || undefined,
        hqLocation,
        serviceRegions: serviceRegionsForm.serviceRegions,
      },
    }
    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowServiceRegionsDialog(false)
    }
  }

  // Audience Persona handlers
  const handleOpenPersonaDialog = (persona?: any) => {
    if (persona) {
      // Parse age range "28-45" → ageStart: "28", ageEnd: "45"
      const ageParts = (persona.ageRange || '').split('-')
      const ageStart = ageParts[0]?.trim() || ''
      const ageEnd = ageParts[1]?.trim() || ''

      setEditingPersona(persona.id)
      setPersonaForm({
        name: persona.name || '',
        description: persona.description || '',
        ageStart,
        ageEnd,
        painPoints: [...(persona.painPoints || [])],
        newPainPoint: '',
      })
    } else {
      setEditingPersona(null)
      setPersonaForm({
        name: '',
        description: '',
        ageStart: '',
        ageEnd: '',
        painPoints: [],
        newPainPoint: '',
      })
    }
    setShowPersonaDialog(true)
  }

  const handleAddPainPoint = () => {
    if (personaForm.newPainPoint.trim()) {
      setPersonaForm(prev => ({
        ...prev,
        painPoints: [...prev.painPoints, prev.newPainPoint.trim()],
        newPainPoint: '',
      }))
    }
  }

  const handleRemovePainPoint = (index: number) => {
    setPersonaForm(prev => ({
      ...prev,
      painPoints: prev.painPoints.filter((_, i) => i !== index),
    }))
  }

  const handleSavePersona = async () => {
    if (!personaForm.name.trim()) {
      toast.error('Persona name is required')
      return
    }

    // Build age range string: "28-45" or just "28" if only start is set
    const ageRange = personaForm.ageStart && personaForm.ageEnd
      ? `${personaForm.ageStart}-${personaForm.ageEnd}`
      : personaForm.ageStart || personaForm.ageEnd || undefined

    const personas = [...(audience.personas || [])]

    if (editingPersona) {
      // Update existing
      const idx = personas.findIndex(p => p.id === editingPersona)
      if (idx !== -1) {
        personas[idx] = {
          id: editingPersona,
          name: personaForm.name,
          description: personaForm.description || undefined,
          ageRange,
          painPoints: personaForm.painPoints,
        }
      }
    } else {
      // Create new
      personas.push({
        id: `persona_${Date.now()}`,
        name: personaForm.name,
        description: personaForm.description || undefined,
        ageRange,
        painPoints: personaForm.painPoints,
      })
    }

    const updatedProfile: BrandProfileData = {
      ...profile,
      audience: {
        ...audience,
        personas,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowPersonaDialog(false)
    }
  }

  const handleDeletePersona = async (personaId: string) => {
    const personas = (audience.personas || []).filter(p => p.id !== personaId)
    const updatedProfile: BrandProfileData = {
      ...profile,
      audience: {
        ...audience,
        personas,
      },
    }
    await handleSaveProfile(updatedProfile)
  }

  // Positioning handlers
  const handleOpenPositioningDialog = () => {
    setPositioningForm({
      category: audience.positioning?.category || '',
      usps: [...(audience.positioning?.usps || [])],
      newUsp: '',
    })
    setShowPositioningDialog(true)
  }

  const handleAddUsp = () => {
    if (positioningForm.newUsp.trim()) {
      setPositioningForm(prev => ({
        ...prev,
        usps: [...prev.usps, prev.newUsp.trim()],
        newUsp: '',
      }))
    }
  }

  const handleRemoveUsp = (index: number) => {
    setPositioningForm(prev => ({
      ...prev,
      usps: prev.usps.filter((_, i) => i !== index),
    }))
  }

  const handleSavePositioning = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      audience: {
        ...audience,
        positioning: {
          ...audience.positioning,
          category: positioningForm.category || undefined,
          usps: positioningForm.usps,
        },
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowPositioningDialog(false)
    }
  }

  // Competitor handlers
  const handleOpenCompetitorDialog = (competitor?: any) => {
    if (competitor) {
      setEditingCompetitor(competitor.id)
      setCompetitorForm({
        name: competitor.name || '',
        note: competitor.note || '',
      })
    } else {
      setEditingCompetitor(null)
      setCompetitorForm({
        name: '',
        note: '',
      })
    }
    setShowCompetitorDialog(true)
  }

  const handleSaveCompetitor = async () => {
    if (!competitorForm.name.trim()) {
      toast.error('Competitor name is required')
      return
    }

    const competitors = [...(audience.positioning?.competitors || [])]

    if (editingCompetitor) {
      // Update existing
      const idx = competitors.findIndex(c => c.id === editingCompetitor)
      if (idx !== -1) {
        competitors[idx] = {
          id: editingCompetitor,
          name: competitorForm.name,
          note: competitorForm.note || undefined,
        }
      }
    } else {
      // Create new
      competitors.push({
        id: `competitor_${Date.now()}`,
        name: competitorForm.name,
        note: competitorForm.note || undefined,
      })
    }

    const updatedProfile: BrandProfileData = {
      ...profile,
      audience: {
        ...audience,
        positioning: {
          ...audience.positioning,
          competitors,
        },
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowCompetitorDialog(false)
    }
  }

  const handleDeleteCompetitor = async (competitorId: string) => {
    const competitors = (audience.positioning?.competitors || []).filter(c => c.id !== competitorId)
    const updatedProfile: BrandProfileData = {
      ...profile,
      audience: {
        ...audience,
        positioning: {
          ...audience.positioning,
          competitors,
        },
      },
    }
    await handleSaveProfile(updatedProfile)
  }

  // Voice Tone handlers
  const handleOpenToneDialog = () => {
    setToneForm({
      formalInformal: voice.toneScales?.formalInformal ?? 0.5,
      seriousPlayful: voice.toneScales?.seriousPlayful ?? 0.5,
      simpleComplex: voice.toneScales?.simpleComplex ?? 0.5,
      warmNeutral: voice.toneScales?.warmNeutral ?? 0.5,
    })
    setShowToneDialog(true)
  }

  const handleSaveTone = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      voice: {
        ...voice,
        toneScales: {
          formalInformal: toneForm.formalInformal,
          seriousPlayful: toneForm.seriousPlayful,
          simpleComplex: toneForm.simpleComplex,
          warmNeutral: toneForm.warmNeutral,
        },
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowToneDialog(false)
    }
  }

  // Do Say handlers
  const handleOpenDoSayDialog = () => {
    setDoSayForm({
      doSay: [...(voice.doSay || [])],
      newPhrase: '',
    })
    setShowDoSayDialog(true)
  }

  const handleAddDoSay = () => {
    if (doSayForm.newPhrase.trim()) {
      setDoSayForm(prev => ({
        ...prev,
        doSay: [...prev.doSay, prev.newPhrase.trim()],
        newPhrase: '',
      }))
    }
  }

  const handleRemoveDoSay = (index: number) => {
    setDoSayForm(prev => ({
      ...prev,
      doSay: prev.doSay.filter((_, i) => i !== index),
    }))
  }

  const handleSaveDoSay = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      voice: {
        ...voice,
        doSay: doSayForm.doSay,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowDoSayDialog(false)
    }
  }

  // Don't Say handlers
  const handleOpenDontSayDialog = () => {
    setDontSayForm({
      dontSay: [...(voice.dontSay || [])],
      newPhrase: '',
    })
    setShowDontSayDialog(true)
  }

  const handleAddDontSay = () => {
    if (dontSayForm.newPhrase.trim()) {
      setDontSayForm(prev => ({
        ...prev,
        dontSay: [...prev.dontSay, prev.newPhrase.trim()],
        newPhrase: '',
      }))
    }
  }

  const handleRemoveDontSay = (index: number) => {
    setDontSayForm(prev => ({
      ...prev,
      dontSay: prev.dontSay.filter((_, i) => i !== index),
    }))
  }

  const handleSaveDontSay = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      voice: {
        ...voice,
        dontSay: dontSayForm.dontSay,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowDontSayDialog(false)
    }
  }

  // Rules: Allowed Topics handlers
  const handleOpenAllowedTopicsDialog = () => {
    setAllowedTopicsForm({
      topics: [...(rules.allowedTopics || [])],
      newTopic: '',
    })
    setShowAllowedTopicsDialog(true)
  }

  const handleAddAllowedTopic = () => {
    if (allowedTopicsForm.newTopic.trim()) {
      setAllowedTopicsForm(prev => ({
        ...prev,
        topics: [...prev.topics, prev.newTopic.trim()],
        newTopic: '',
      }))
    }
  }

  const handleRemoveAllowedTopic = (index: number) => {
    setAllowedTopicsForm(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== index),
    }))
  }

  const handleSaveAllowedTopics = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      rules: {
        ...rules,
        allowedTopics: allowedTopicsForm.topics,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowAllowedTopicsDialog(false)
    }
  }

  // Rules: Forbidden Topics & Crisis Guidelines handlers
  const handleOpenForbiddenTopicsDialog = () => {
    setForbiddenTopicsForm({
      topics: [...(rules.forbiddenTopics || [])],
      newTopic: '',
      crisisGuidelines: [...(rules.crisisGuidelines || [])],
      newGuideline: '',
    })
    setShowForbiddenTopicsDialog(true)
  }

  const handleAddForbiddenTopic = () => {
    if (forbiddenTopicsForm.newTopic.trim()) {
      setForbiddenTopicsForm(prev => ({
        ...prev,
        topics: [...prev.topics, prev.newTopic.trim()],
        newTopic: '',
      }))
    }
  }

  const handleRemoveForbiddenTopic = (index: number) => {
    setForbiddenTopicsForm(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== index),
    }))
  }

  const handleAddCrisisGuideline = () => {
    if (forbiddenTopicsForm.newGuideline.trim()) {
      setForbiddenTopicsForm(prev => ({
        ...prev,
        crisisGuidelines: [...prev.crisisGuidelines, prev.newGuideline.trim()],
        newGuideline: '',
      }))
    }
  }

  const handleRemoveCrisisGuideline = (index: number) => {
    setForbiddenTopicsForm(prev => ({
      ...prev,
      crisisGuidelines: prev.crisisGuidelines.filter((_, i) => i !== index),
    }))
  }

  const handleSaveForbiddenTopics = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      rules: {
        ...rules,
        forbiddenTopics: forbiddenTopicsForm.topics,
        crisisGuidelines: forbiddenTopicsForm.crisisGuidelines,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowForbiddenTopicsDialog(false)
    }
  }

  // Rules: Legal Constraints handlers
  const handleOpenLegalConstraintDialog = (constraint?: any) => {
    if (constraint) {
      setEditingLegalConstraint(constraint.id)
      setLegalConstraintForm({
        title: constraint.title || '',
        description: constraint.description || '',
      })
    } else {
      setEditingLegalConstraint(null)
      setLegalConstraintForm({
        title: '',
        description: '',
      })
    }
    setShowLegalConstraintDialog(true)
  }

  const handleSaveLegalConstraint = async () => {
    if (!legalConstraintForm.title.trim()) {
      toast.error('Title is required')
      return
    }

    const legalConstraints = [...(rules.legalConstraints || [])]

    if (editingLegalConstraint) {
      // Update existing
      const idx = legalConstraints.findIndex(c => c.id === editingLegalConstraint)
      if (idx !== -1) {
        legalConstraints[idx] = {
          id: editingLegalConstraint,
          title: legalConstraintForm.title,
          description: legalConstraintForm.description,
        }
      }
    } else {
      // Create new
      legalConstraints.push({
        id: `legal_${Date.now()}`,
        title: legalConstraintForm.title,
        description: legalConstraintForm.description,
      })
    }

    const updatedProfile: BrandProfileData = {
      ...profile,
      rules: {
        ...rules,
        legalConstraints,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowLegalConstraintDialog(false)
    }
  }

  const handleDeleteLegalConstraint = async (constraintId: string) => {
    const legalConstraints = (rules.legalConstraints || []).filter(c => c.id !== constraintId)
    const updatedProfile: BrandProfileData = {
      ...profile,
      rules: {
        ...rules,
        legalConstraints,
      },
    }
    await handleSaveProfile(updatedProfile)
  }

  // Assets: Brand Colors handlers
  const handleOpenBrandColorsDialog = () => {
    setBrandColorsForm({
      primary: [...(assets.brandColors?.primary || [])],
      accent: [...(assets.brandColors?.accent || [])],
      newPrimary: '#3b82f6',
      newAccent: '#10b981',
    })
    setShowBrandColorsDialog(true)
  }

  const handleAddPrimaryColor = () => {
    if (brandColorsForm.newPrimary) {
      setBrandColorsForm(prev => ({
        ...prev,
        primary: [...prev.primary, prev.newPrimary],
      }))
    }
  }

  const handleRemovePrimaryColor = (index: number) => {
    setBrandColorsForm(prev => ({
      ...prev,
      primary: prev.primary.filter((_, i) => i !== index),
    }))
  }

  const handleAddAccentColor = () => {
    if (brandColorsForm.newAccent) {
      setBrandColorsForm(prev => ({
        ...prev,
        accent: [...prev.accent, prev.newAccent],
      }))
    }
  }

  const handleRemoveAccentColor = (index: number) => {
    setBrandColorsForm(prev => ({
      ...prev,
      accent: prev.accent.filter((_, i) => i !== index),
    }))
  }

  const handleSaveBrandColors = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      assets: {
        ...assets,
        brandColors: {
          primary: brandColorsForm.primary,
          accent: brandColorsForm.accent,
        },
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowBrandColorsDialog(false)
    }
  }

  // Assets: Visual Guidelines handlers
  const handleOpenVisualGuidelinesDialog = () => {
    setVisualGuidelinesForm({
      guidelines: [...(assets.visualGuidelines || [])],
      newGuideline: '',
    })
    setShowVisualGuidelinesDialog(true)
  }

  const handleAddVisualGuideline = () => {
    if (visualGuidelinesForm.newGuideline.trim()) {
      setVisualGuidelinesForm(prev => ({
        ...prev,
        guidelines: [...prev.guidelines, prev.newGuideline.trim()],
        newGuideline: '',
      }))
    }
  }

  const handleRemoveVisualGuideline = (index: number) => {
    setVisualGuidelinesForm(prev => ({
      ...prev,
      guidelines: prev.guidelines.filter((_, i) => i !== index),
    }))
  }

  const handleSaveVisualGuidelines = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      assets: {
        ...assets,
        visualGuidelines: visualGuidelinesForm.guidelines,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowVisualGuidelinesDialog(false)
    }
  }

  // Assets: AI Configuration handlers
  const handleOpenAiConfigDialog = () => {
    setAiConfigForm({
      defaultLanguage: aiConfig.defaultLanguage || brand?.primaryLocale || '',
      contentLengthMin: aiConfig.contentLength?.min?.toString() || '',
      contentLengthMax: aiConfig.contentLength?.max?.toString() || '',
      contentLengthUnit: aiConfig.contentLength?.unit || 'chars',
      ctaStyle: aiConfig.ctaStyle || '',
      preferredPlatforms: [...(aiConfig.preferredPlatforms || [])],
      newPlatform: '',
    })
    setShowAiConfigDialog(true)
  }

  const handleAddPlatform = () => {
    if (aiConfigForm.newPlatform.trim()) {
      setAiConfigForm(prev => ({
        ...prev,
        preferredPlatforms: [...prev.preferredPlatforms, prev.newPlatform.trim()],
        newPlatform: '',
      }))
    }
  }

  const handleRemovePlatform = (index: number) => {
    setAiConfigForm(prev => ({
      ...prev,
      preferredPlatforms: prev.preferredPlatforms.filter((_, i) => i !== index),
    }))
  }

  const handleSaveAiConfig = async () => {
    const updatedProfile: BrandProfileData = {
      ...profile,
      aiConfig: {
        defaultLanguage: aiConfigForm.defaultLanguage || undefined,
        contentLength: {
          min: aiConfigForm.contentLengthMin ? parseInt(aiConfigForm.contentLengthMin) : undefined,
          max: aiConfigForm.contentLengthMax ? parseInt(aiConfigForm.contentLengthMax) : undefined,
          unit: aiConfigForm.contentLengthUnit,
        },
        ctaStyle: aiConfigForm.ctaStyle || undefined,
        preferredPlatforms: aiConfigForm.preferredPlatforms,
      },
    }

    const success = await handleSaveProfile(updatedProfile)
    if (success) {
      setShowAiConfigDialog(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        toast.error(`Image size should be less than ${MAX_AVATAR_SIZE_MB}MB`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setShowCropDialog(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.src = url
    })

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('No 2d context')
    }

    const maxSize = Math.max(image.width, image.height)
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))

    canvas.width = safeArea
    canvas.height = safeArea

    ctx.translate(safeArea / 2, safeArea / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-safeArea / 2, -safeArea / 2)

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    )

    const data = ctx.getImageData(0, 0, safeArea, safeArea)

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.putImageData(
      data,
      0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
      0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
    )

    return new Promise((resolve) => {
      canvas.toBlob((file) => {
        resolve(file as Blob)
      }, 'image/jpeg')
    })
  }

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels || !brand || !currentWorkspace?.id) return

    setIsUploading(true)
    try {
      // Get cropped blob
      const croppedBlob = await getCroppedImg(
        selectedImage,
        croppedAreaPixels,
        rotation
      )

      // Immediately show blob preview
      const blobUrl = URL.createObjectURL(croppedBlob)
      setPreviewLogoUrl(blobUrl)

      // Notify brand-switcher and header to update logo preview
      window.dispatchEvent(new CustomEvent('brand-logo-preview', {
        detail: { brandId: brand.id, previewUrl: blobUrl }
      }))

      // Close dialog and reset states
      setShowCropDialog(false)
      setSelectedImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)

      // Get current brand data to check for existing logo
      const currentBrandResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands`,
        { credentials: 'include' }
      )
      const currentBrandData = await currentBrandResponse.json()
      const currentBrand = currentBrandData.brands?.find((b: { id: string; logoMediaId?: string }) => b.id === brand.id)
      const oldLogoMediaId = currentBrand?.logoMediaId

      // Upload new logo
      const formData = new FormData()
      formData.append('file', croppedBlob, 'brand-logo.jpg')
      formData.append('title', `${brand.name} Logo`)
      formData.append('isPublic', 'false')

      const uploadResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/media`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Workspace-Id': currentWorkspace.id,
          },
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        console.error('Upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData,
        })
        throw new Error(errorData.error?.message || 'Upload failed')
      }

      const uploadData = await uploadResponse.json()
      console.log('Upload response:', uploadData)

      if (!uploadData.success || !uploadData.media?.id) {
        throw new Error('Invalid upload response')
      }

      const mediaId = uploadData.media.id

      // Update brand with new logo
      const updateResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands/${brand.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ logoMediaId: mediaId }),
        }
      )

      if (!updateResponse.ok) {
        throw new Error('Failed to update brand')
      }

      // Delete old logo if it exists
      if (oldLogoMediaId) {
        try {
          const deleteResponse = await fetch(
            `http://localhost:3001/workspaces/${currentWorkspace.id}/media/${oldLogoMediaId}`,
            {
              method: 'DELETE',
              credentials: 'include',
            }
          )
          if (deleteResponse.ok) {
            console.log('Old logo deleted successfully:', oldLogoMediaId)
          } else {
            console.warn('Failed to delete old logo:', oldLogoMediaId)
          }
        } catch (error) {
          console.warn('Error deleting old logo:', error)
          // Don't fail the whole operation if deletion fails
        }
      }

      toast.success('Brand logo updated successfully')

      // Note: Blob preview will stay until page refresh
      // This gives instant feedback. Real S3 URL will load on next page visit.
    } catch (error) {
      console.error('Failed to update logo:', error)
      toast.error('Failed to update brand logo')
      // Clear preview on error
      if (previewLogoUrl) {
        URL.revokeObjectURL(previewLogoUrl)
        setPreviewLogoUrl(null)
      }
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p className="text-muted-foreground">Brand not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Avatar with edit button */}
          <div className="relative">
            <Avatar className="h-20 w-20 rounded-full">
              <AvatarImage
                src={previewLogoUrl || brand.logoUrl || undefined}
                alt={brand.name}
                key={previewLogoUrl || brand.logoUrl || 'fallback'}
              />
              <AvatarFallback className="rounded-full text-2xl">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Brand info */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{brand.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {brand.industry && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {brand.industry}
                </Badge>
              )}
              {brand.city && brand.country && (
                <span>{brand.city}, {brand.country}</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs with Edit Button */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsList className="relative inline-flex items-center gap-1 rounded-lg bg-muted p-1 min-w-max">
              <TabsHighlight className="bg-background shadow-sm rounded-md">
                <TabsHighlightItem value="overview">
                  <TabsTrigger value="overview" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconLayoutDashboard className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "overview") && <span>{t('brandProfile.tabs.overview')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>

                <TabsHighlightItem value="business">
                  <TabsTrigger value="business" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconBriefcase className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "business") && <span>{t('brandProfile.tabs.business')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>

                <TabsHighlightItem value="audience">
                  <TabsTrigger value="audience" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconUsers className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "audience") && <span>{t('brandProfile.tabs.audience')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>

                <TabsHighlightItem value="voice">
                  <TabsTrigger value="voice" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconMessageCircle className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "voice") && <span>{t('brandProfile.tabs.voice')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>

                <TabsHighlightItem value="rules">
                  <TabsTrigger value="rules" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconShieldCheck className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "rules") && <span>{t('brandProfile.tabs.rules')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>

                <TabsHighlightItem value="assets">
                  <TabsTrigger value="assets" className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground md:gap-2 md:px-3">
                    <IconPalette className="h-4 w-4 shrink-0" />
                    {(!isMobile || activeTab === "assets") && <span>{t('brandProfile.tabs.assets')}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
              </TabsHighlight>
            </TabsList>
          </div>
        </div>

        <motion.div
          className="mt-4"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, info: PanInfo) => {
            const swipeThreshold = 50
            if (info.offset.x > swipeThreshold) {
              handleSwipe('right')
            } else if (info.offset.x < -swipeThreshold) {
              handleSwipe('left')
            }
          }}
        >
          <TabsContents>
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {/* Optimization Score - Outer Container */}
              <div className="relative rounded-3xl bg-gradient-to-br from-white/80 via-purple-50/30 to-white/80 dark:from-background dark:via-purple-950/10 dark:to-background p-2 pb-4 shadow-sm">
                {/* Purple glow effect at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-purple-500/10 to-transparent rounded-b-2xl pointer-events-none" />

                {/* Inner Card */}
                <Card className="relative bg-background/60 backdrop-blur-sm border-0 shadow-md">
                  <CardContent className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{t('brandProfile.overview.optimizationScore')}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleRefreshOptimizationScore}
                            disabled={isRefreshingScore}
                          >
                            <IconSparkles className={`h-4 w-4 ${isRefreshingScore ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                          {optimizationScore !== null ? (
                            <>
                              <CountingNumber
                                number={optimizationScore}
                                delay={0.3}
                                transition={{ stiffness: 100, damping: 30 }}
                              />
                              %
                            </>
                          ) : (
                            <span className="text-muted-foreground text-lg">{t('brandProfile.overview.notCalculated')}</span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="relative h-3 w-full">
                          {/* Progress bar container with overflow hidden */}
                          <div className="absolute inset-0 rounded-full overflow-hidden">
                            {/* Animated gradient bar */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 transition-all duration-1000 ease-out"
                              style={{ width: `${progressValue}%` }}
                            />

                            {/* Dotted remaining portion - responsive */}
                            <div
                              className="absolute inset-y-0 left-0 right-0 rounded-full flex items-center justify-start gap-1 px-2 overflow-hidden transition-all duration-1000"
                              style={{ paddingLeft: `calc(${progressValue}% + 8px)` }}
                            >
                              {Array.from({ length: 100 }).map((_, i) => (
                                <div key={i} className="w-0.5 h-2 bg-muted-foreground/20 rounded-full flex-shrink-0" />
                              ))}
                            </div>
                          </div>

                          {/* Circular indicator at the end - outside overflow container */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center z-10 transition-all duration-1000 ease-out border border-muted-foreground/10"
                            style={{
                              left: `${progressValue}%`,
                              opacity: progressValue > 0 ? 1 : 0,
                              scale: progressValue > 0 ? 1 : 0.5
                            }}
                          >
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Footer - Outside the inner card */}
                <div className="relative flex items-center justify-between text-sm mt-4 px-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{t('brandProfile.overview.lastUpdate')}</span>
                    {optimizationScoreUpdatedAt ? (
                      <>
                        <span className="text-orange-500 font-medium">
                          {formatDateShort(optimizationScoreUpdatedAt, user?.locale || 'en-US')}
                        </span>
                        <span className="text-purple-500">
                          {t('brandProfile.overview.at')} {formatTimeShort(optimizationScoreUpdatedAt, user?.timeFormat === 'H12' ? TimeFormat.H12 : TimeFormat.H24)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">{t('brandProfile.overview.notSet')}</span>
                    )}
                  </div>
                  {optimizationScore !== null && (
                    <Badge
                      variant="secondary"
                      className={
                        optimizationScore >= 80
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900"
                          : optimizationScore >= 50
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
                            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
                      }
                    >
                      {optimizationScore >= 80 ? t('brandProfile.overview.healthy') : optimizationScore >= 50 ? t('brandProfile.overview.needsWork') : t('brandProfile.overview.atRisk')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Brand Identity Section */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.overview.brandIdentity')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenIdentityDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.overview.tagline')}</p>
                      <p className="text-sm">
                        {identity.tagline || brand.description || <span className="text-muted-foreground italic">{t('brandProfile.overview.notSet')}</span>}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.overview.mission')}</p>
                      <p className="text-sm">
                        {identity.mission || <span className="text-muted-foreground italic">{t('brandProfile.overview.notSet')}</span>}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.overview.vision')}</p>
                      <p className="text-sm">
                        {identity.vision || <span className="text-muted-foreground italic">{t('brandProfile.overview.notSet')}</span>}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact & Quick Facts Row */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.overview.contactChannels')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleAddContact}>
                      <IconPlus className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contactChannels.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">{t('brandProfile.overview.noContactsYet')}</p>
                        <Button variant="outline" size="sm" onClick={handleAddContact}>
                          <IconPlus className="h-4 w-4" />
                          {t('brandProfile.overview.addContact')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contactChannels.map((channel) => {
                          const IconComponent = contactTypeIcons[channel.type]
                          return (
                            <div
                              key={channel.id}
                              className="flex items-center justify-between text-sm group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                                </div>
                                {channel.type === 'WEBSITE' ? (
                                  <a
                                    href={channel.value.startsWith('http') ? channel.value : `https://${channel.value}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {channel.value}
                                  </a>
                                ) : (
                                  <span>{channel.value}</span>
                                )}
                                {channel.isPrimary && (
                                  <Badge variant="outline" className="text-xs">{t('brandProfile.overview.primary')}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {channel.label && (
                                  <Badge variant="secondary" className="text-xs">{channel.label}</Badge>
                                )}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleEditContact(channel)}
                                  >
                                    <IconPencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteContact(channel.id)}
                                  >
                                    <IconTrash className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.overview.quickFacts')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenQuickFactsDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.overview.primaryLanguage')}</span>
                        <span className="font-medium">{brand.primaryLocale || t('brandProfile.overview.notSet')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.overview.timezone')}</span>
                        <span className="font-medium">{brand.timezone || t('brandProfile.overview.notSet')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.overview.industry')}</span>
                        <span className="font-medium capitalize">{brand.industry || t('brandProfile.overview.notSet')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.overview.location')}</span>
                        <span className="font-medium">
                          {brand.city && brand.country
                            ? `${brand.city}, ${brand.country}`
                            : t('brandProfile.overview.notSet')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.overview.workingHours')}</span>
                        <span className="font-medium">{quickFacts.workingHours || t('brandProfile.overview.notSet')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Business & Offering Tab */}
            <TabsContent value="business" className="space-y-4">
              {/* Business Overview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.business.businessOverview')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenBusinessOverviewDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{t('brandProfile.business.businessType')}</div>
                      <div className="font-medium">{businessProfile.businessType || <span className="text-muted-foreground italic">{t('brandProfile.business.notSet')}</span>}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{t('brandProfile.business.marketType')}</div>
                      <div className="font-medium">{businessProfile.marketType || <span className="text-muted-foreground italic">{t('brandProfile.business.notSet')}</span>}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{t('brandProfile.business.deliveryModel')}</div>
                      <div className="font-medium">{businessProfile.deliveryModel || <span className="text-muted-foreground italic">{t('brandProfile.business.notSet')}</span>}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Core Offerings */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.business.coreOfferings')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenCoreOfferingsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 text-sm">
                    <div>
                      <div className="mb-3 text-xs font-medium text-muted-foreground">
                        {t('brandProfile.business.coreServices')}
                      </div>
                      {(businessProfile.coreServices ?? []).length > 0 ? (
                        <ul className="space-y-2">
                          {(businessProfile.coreServices ?? []).map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <span>{item}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <IconX className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('brandProfile.business.noServicesYet')}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 text-xs font-medium text-muted-foreground">
                        {t('brandProfile.business.coreProducts')}
                      </div>
                      {(businessProfile.coreProducts ?? []).length > 0 ? (
                        <ul className="space-y-2">
                          {(businessProfile.coreProducts ?? []).map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <span>{item}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <IconX className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('brandProfile.business.noProductsYet')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sales & Service Channels */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.business.salesAndService')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenSalesChannelsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 text-sm">
                    <div>
                      <div className="mb-3 text-xs font-medium text-muted-foreground">
                        {t('brandProfile.business.salesChannels')}
                      </div>
                      {(businessProfile.salesChannels ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(businessProfile.salesChannels ?? []).map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                              {item}
                              <button className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                                <IconX className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('brandProfile.business.noSalesChannels')}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 text-xs font-medium text-muted-foreground">
                        {t('brandProfile.business.transactionTypes')}
                      </div>
                      {(businessProfile.transactionTypes ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(businessProfile.transactionTypes ?? []).map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                              {item}
                              <button className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                                <IconX className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('brandProfile.business.noTransactionTypes')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Regions & Structure */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.business.serviceRegions')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenServiceRegionsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 text-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('brandProfile.business.structureType')}</span>
                        <span className="font-medium">{businessProfile.structureType || <span className="text-muted-foreground italic">{t('brandProfile.business.notSet')}</span>}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('brandProfile.business.hqLocation')}</span>
                        <span className="font-medium">{businessProfile.hqLocation || <span className="text-muted-foreground italic">{t('brandProfile.business.notSet')}</span>}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-xs font-medium text-muted-foreground">
                        {t('brandProfile.business.regions')}
                      </div>
                      {(businessProfile.serviceRegions ?? []).length > 0 ? (
                        <div className="space-y-2">
                          {(businessProfile.serviceRegions ?? []).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                              <span>{item}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <IconX className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          {t('brandProfile.business.noRegions')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audience & Positioning Tab */}
            <TabsContent value="audience" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.audience.primaryPersonas')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleOpenPersonaDialog()}>
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {(audience.personas ?? []).length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(audience.personas ?? []).map((persona) => (
                        <div key={persona.id} className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{persona.name}</h4>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenPersonaDialog(persona)}>
                                <IconPencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePersona(persona.id)}>
                                <IconTrash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {persona.ageRange && `Age ${persona.ageRange} • `}{persona.description || 'No description'}
                          </p>
                          {(persona.painPoints ?? []).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Pain Points</p>
                              <div className="flex flex-wrap gap-1">
                                {(persona.painPoints ?? []).map((point, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{point}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground mb-3">No personas defined yet</p>
                      <Button variant="outline" size="sm" onClick={() => handleOpenPersonaDialog()}>
                        <IconPlus className="h-4 w-4" />
                        {t('brandProfile.audience.addPersona')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.audience.positioning')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenPositioningDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('brandProfile.audience.category')}</span>
                      {audience.positioning?.category ? (
                        <Badge variant="secondary">{audience.positioning.category}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Not set</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium">{t('brandProfile.audience.usps')}</p>
                      {(audience.positioning?.usps ?? []).length > 0 ? (
                        <ul className="text-sm space-y-1.5">
                          {(audience.positioning?.usps ?? []).map((usp, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                              <span>{usp}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">{t('brandProfile.audience.noUspsYet')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.audience.competitors')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleOpenCompetitorDialog()}>
                      <IconPlus className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(audience.positioning?.competitors ?? []).length > 0 ? (
                      <div className="space-y-2">
                        {(audience.positioning?.competitors ?? []).map((competitor) => (
                          <div key={competitor.id} className="flex items-start justify-between p-2 rounded-lg bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{competitor.name}</p>
                              {competitor.note && (
                                <p className="text-xs text-muted-foreground">{competitor.note}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCompetitorDialog(competitor)}>
                                <IconPencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteCompetitor(competitor.id)}>
                                <IconTrash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">{t('brandProfile.audience.noCompetitorsYet')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Voice & Tone Tab */}
            <TabsContent value="voice" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.voice.toneCharacteristics.title')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenToneDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Formal - Informal */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.formal')}</span>
                        <span className="font-medium">{Math.round((voice.toneScales?.formalInformal ?? 0.5) * 100)}%</span>
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.informal')}</span>
                      </div>
                      <Slider value={[Math.round((voice.toneScales?.formalInformal ?? 0.5) * 100)]} max={100} step={1} disabled />
                    </div>

                    {/* Serious - Playful */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.serious')}</span>
                        <span className="font-medium">{Math.round((voice.toneScales?.seriousPlayful ?? 0.5) * 100)}%</span>
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.playful')}</span>
                      </div>
                      <Slider value={[Math.round((voice.toneScales?.seriousPlayful ?? 0.5) * 100)]} max={100} step={1} disabled />
                    </div>

                    {/* Simple - Complex */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.simple')}</span>
                        <span className="font-medium">{Math.round((voice.toneScales?.simpleComplex ?? 0.5) * 100)}%</span>
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.complex')}</span>
                      </div>
                      <Slider value={[Math.round((voice.toneScales?.simpleComplex ?? 0.5) * 100)]} max={100} step={1} disabled />
                    </div>

                    {/* Warm - Neutral */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.warm')}</span>
                        <span className="font-medium">{Math.round((voice.toneScales?.warmNeutral ?? 0.5) * 100)}%</span>
                        <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.neutral')}</span>
                      </div>
                      <Slider value={[Math.round((voice.toneScales?.warmNeutral ?? 0.5) * 100)]} max={100} step={1} disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <IconCheck className="h-4 w-4 text-green-600" />
                      {t('brandProfile.voice.doSay.title')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenDoSayDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(voice.doSay ?? []).length > 0 ? (
                      <ul className="space-y-2">
                        {(voice.doSay ?? []).map((phrase, i) => (
                          <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm group hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                            <span>&quot;{phrase}&quot;</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <IconX className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground text-center py-4">{t('brandProfile.voice.doSay.emptyState')}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <IconX className="h-4 w-4 text-red-600" />
                      {t('brandProfile.voice.dontSay.title')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenDontSayDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(voice.dontSay ?? []).length > 0 ? (
                      <ul className="space-y-2">
                        {(voice.dontSay ?? []).map((phrase, i) => (
                          <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                            <span>&quot;{phrase}&quot;</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <IconX className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground text-center py-4">{t('brandProfile.voice.dontSay.emptyState')}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Content Rules Tab */}
            <TabsContent value="rules" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.rules.allowedTopics.title')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenAllowedTopicsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {(rules.allowedTopics ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(rules.allowedTopics ?? []).map((topic, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {topic}
                          <button className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                            <IconX className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground text-center py-4">{t('brandProfile.rules.allowedTopics.emptyState')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.rules.forbiddenTopics.title')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenForbiddenTopicsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.rules.forbiddenTopics.topicsToAvoid')}</p>
                    {(rules.forbiddenTopics ?? []).length > 0 ? (
                      (rules.forbiddenTopics ?? []).map((topic, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                          <span className="flex items-center gap-2">
                            <IconX className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            {topic}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconX className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-muted-foreground">{t('brandProfile.rules.forbiddenTopics.emptyState')}</p>
                    )}
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{t('brandProfile.rules.forbiddenTopics.crisisGuidelines')}</p>
                    {(rules.crisisGuidelines ?? []).length > 0 ? (
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        {(rules.crisisGuidelines ?? []).map((guideline, i) => (
                          <li key={i}>• {guideline}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">{t('brandProfile.rules.forbiddenTopics.crisisEmptyState')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    ⚖️ {t('brandProfile.rules.legalConstraints.title')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleOpenLegalConstraintDialog()}>
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {(rules.legalConstraints ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(rules.legalConstraints ?? []).map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-3 rounded-lg bg-background border border-amber-200 dark:border-amber-900/50 group hover:shadow-sm transition-shadow">
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-0.5">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-100" onClick={() => handleOpenLegalConstraintDialog(item)}>
                              <IconPencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive opacity-100" onClick={() => handleDeleteLegalConstraint(item.id)}>
                              <IconTrash className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground text-center py-4">{t('brandProfile.rules.legalConstraints.emptyState')}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assets & AI Config Tab */}
            <TabsContent value="assets" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">{t('brandProfile.assets.brandColors.title')}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenBrandColorsDialog}>
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.assets.brandColors.primaryColors')}</p>
                      {(assets.brandColors?.primary ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(assets.brandColors?.primary ?? []).map((color, i) => (
                            <ColorPicker
                              key={i}
                              value={color}
                              onValueChange={async (newColor) => {
                                const updatedProfile: BrandProfileData = {
                                  ...profile,
                                  assets: {
                                    ...assets,
                                    brandColors: {
                                      ...assets.brandColors,
                                      primary: (assets.brandColors?.primary || []).map((c, idx) => idx === i ? newColor : c),
                                    },
                                  },
                                }
                                await handleSaveProfile(updatedProfile)
                              }}
                            >
                              <ColorPickerTrigger asChild>
                                <button className="group relative block">
                                  <div
                                    className="h-12 w-12 rounded-lg border-2 border-muted transition-all group-hover:scale-110 group-hover:border-foreground/20 cursor-pointer"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="block text-xs text-muted-foreground mt-1 font-mono">{color}</span>
                                </button>
                              </ColorPickerTrigger>
                              <ColorPickerContent>
                                <ColorPickerArea />
                                <ColorPickerHueSlider />
                                <ColorPickerInput />
                              </ColorPickerContent>
                            </ColorPicker>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">{t('brandProfile.assets.brandColors.primaryEmptyState')}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{t('brandProfile.assets.brandColors.accentColors')}</p>
                      {(assets.brandColors?.accent ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(assets.brandColors?.accent ?? []).map((color, i) => (
                            <ColorPicker
                              key={i}
                              value={color}
                              onValueChange={async (newColor) => {
                                const updatedProfile: BrandProfileData = {
                                  ...profile,
                                  assets: {
                                    ...assets,
                                    brandColors: {
                                      ...assets.brandColors,
                                      accent: (assets.brandColors?.accent || []).map((c, idx) => idx === i ? newColor : c),
                                    },
                                  },
                                }
                                await handleSaveProfile(updatedProfile)
                              }}
                            >
                              <ColorPickerTrigger asChild>
                                <button className="group relative block">
                                  <div
                                    className="h-12 w-12 rounded-lg border-2 border-muted transition-all group-hover:scale-110 group-hover:border-foreground/20 cursor-pointer"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="block text-xs text-muted-foreground mt-1 font-mono">{color}</span>
                                </button>
                              </ColorPickerTrigger>
                              <ColorPickerContent>
                                <ColorPickerArea />
                                <ColorPickerHueSlider />
                                <ColorPickerInput />
                              </ColorPickerContent>
                            </ColorPicker>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">{t('brandProfile.assets.brandColors.accentEmptyState')}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.assets.visualGuidelines.title')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenVisualGuidelinesDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(assets.visualGuidelines ?? []).length > 0 ? (
                      <ul className="text-sm space-y-2">
                        {(assets.visualGuidelines ?? []).map((rule, i) => (
                          <li key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <IconCheck className="h-4 w-4 text-green-600 shrink-0" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground text-center py-4">{t('brandProfile.assets.visualGuidelines.emptyState')}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base font-semibold">{t('brandProfile.assets.aiConfiguration.title')}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleOpenAiConfigDialog}>
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.assets.aiConfiguration.defaultLanguage')}</span>
                        <span className="font-medium">{aiConfig.defaultLanguage || brand.primaryLocale || t('brandProfile.overview.notSet')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.assets.aiConfiguration.contentLength')}</span>
                        <span className="font-medium">
                          {aiConfig.contentLength
                            ? `${aiConfig.contentLength.min ?? '?'}-${aiConfig.contentLength.max ?? '?'} ${aiConfig.contentLength.unit ?? 'chars'}`
                            : t('brandProfile.overview.notSet')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('brandProfile.assets.aiConfiguration.ctaStyle')}</span>
                        <span className="font-medium">{aiConfig.ctaStyle || t('brandProfile.overview.notSet')}</span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">{t('brandProfile.assets.aiConfiguration.preferredPlatforms')}</p>
                        {(aiConfig.preferredPlatforms ?? []).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(aiConfig.preferredPlatforms ?? []).map((platform, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{platform}</Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">{t('brandProfile.assets.aiConfiguration.platformsEmptyState')}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </TabsContents>
        </motion.div>
      </Tabs>

      {/* Contact Channel Dialog */}
      <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{editingContact ? t('brandProfile.dialogs.contactChannel.titleEdit') : t('brandProfile.dialogs.contactChannel.titleAdd')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowContactInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {editingContact ? t('brandProfile.dialogs.contactChannel.descriptionEdit') : t('brandProfile.dialogs.contactChannel.descriptionAdd')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="contact-type">{t('brandProfile.dialogs.contactChannel.typeLabel')}</Label>
              <Select
                value={contactForm.type}
                onValueChange={handleContactTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contactTypeLabels).map(([type, label]) => (
                    <SelectItem key={type} value={type}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone / WhatsApp Input with Country Code */}
            {(contactForm.type === 'PHONE' || contactForm.type === 'WHATSAPP') && (
              <div className="space-y-2">
                <Label>{contactForm.type === 'PHONE' ? t('brandProfile.dialogs.contactChannel.phoneLabel') : t('brandProfile.dialogs.contactChannel.whatsappLabel')}</Label>
                <div className="flex gap-2">
                  <Select
                    value={contactForm.countryCode}
                    onValueChange={(value) => setContactForm(prev => ({ ...prev, countryCode: value }))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodes.map((cc) => (
                        <SelectItem key={cc.code} value={cc.code}>
                          {cc.flag} {cc.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={t('brandProfile.dialogs.contactChannel.phonePlaceholder')}
                    value={contactForm.phoneNumber || ''}
                    onChange={handlePhoneChange}
                    className="flex-1"
                  />
                </div>
              </div>
            )}

            {/* Email Input with Validation */}
            {contactForm.type === 'EMAIL' && (
              <div className="space-y-2">
                <Label htmlFor="contact-email">{t('brandProfile.dialogs.contactChannel.emailLabel')}</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder={t('brandProfile.dialogs.contactChannel.emailPlaceholder')}
                  value={contactForm.value}
                  onChange={handleEmailChange}
                  className={contactEmailError ? 'border-red-500' : ''}
                />
                {contactEmailError && (
                  <p className="text-xs text-red-500">{t('brandProfile.dialogs.contactChannel.emailError')}</p>
                )}
              </div>
            )}

            {/* Website Input with https:// prefix */}
            {contactForm.type === 'WEBSITE' && (
              <div className="space-y-2">
                <Label htmlFor="contact-website">{t('brandProfile.dialogs.contactChannel.websiteLabel')}</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                    https://
                  </span>
                  <Input
                    id="contact-website"
                    placeholder={t('brandProfile.dialogs.contactChannel.websitePlaceholder')}
                    value={contactForm.value}
                    onChange={handleWebsiteChange}
                    className="rounded-l-none"
                  />
                </div>
              </div>
            )}

            {/* Address Input */}
            {contactForm.type === 'ADDRESS' && (
              <div className="space-y-2">
                <Label htmlFor="contact-address">{t('brandProfile.dialogs.contactChannel.addressLabel')}</Label>
                <Textarea
                  id="contact-address"
                  placeholder={t('brandProfile.dialogs.contactChannel.addressPlaceholder')}
                  value={contactForm.value}
                  onChange={(e) => setContactForm(prev => ({ ...prev, value: e.target.value }))}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contact-label">{t('brandProfile.dialogs.contactChannel.labelLabel')}</Label>
              <Input
                id="contact-label"
                placeholder={t('brandProfile.dialogs.contactChannel.labelPlaceholder')}
                value={contactForm.label ?? ''}
                onChange={(e) => setContactForm(prev => ({ ...prev, label: e.target.value || null }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="contact-primary"
                checked={contactForm.isPrimary ?? false}
                onCheckedChange={(checked) => setContactForm(prev => ({ ...prev, isPrimary: checked as boolean }))}
              />
              <Label htmlFor="contact-primary" className="text-sm font-normal cursor-pointer">{t('brandProfile.dialogs.contactChannel.markAsPrimary')}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddContactDialog(false)}
              disabled={isContactSaving}
            >
              {t('brandProfile.dialogs.contactChannel.cancel')}
            </Button>
            <Button
              onClick={handleSaveContact}
              disabled={isContactSaving || !isContactFormValid()}
            >
              {isContactSaving ? t('brandProfile.dialogs.contactChannel.saving') : editingContact ? t('brandProfile.dialogs.contactChannel.update') : t('brandProfile.dialogs.contactChannel.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Identity Edit Dialog */}
      <Dialog open={showIdentityDialog} onOpenChange={setShowIdentityDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.brandIdentity.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowIdentityInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.brandIdentity.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="identity-tagline">{t('brandProfile.dialogs.brandIdentity.taglineLabel')}</Label>
              <Input
                id="identity-tagline"
                placeholder={t('brandProfile.dialogs.brandIdentity.taglinePlaceholder')}
                value={identityForm.tagline}
                onChange={(e) => setIdentityForm(prev => ({ ...prev, tagline: e.target.value }))}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground">{identityForm.tagline.length}/300</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="identity-mission">{t('brandProfile.dialogs.brandIdentity.missionLabel')}</Label>
              <Textarea
                id="identity-mission"
                placeholder={t('brandProfile.dialogs.brandIdentity.missionPlaceholder')}
                value={identityForm.mission}
                onChange={(e) => setIdentityForm(prev => ({ ...prev, mission: e.target.value }))}
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{identityForm.mission.length}/1000</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="identity-vision">{t('brandProfile.dialogs.brandIdentity.visionLabel')}</Label>
              <Textarea
                id="identity-vision"
                placeholder={t('brandProfile.dialogs.brandIdentity.visionPlaceholder')}
                value={identityForm.vision}
                onChange={(e) => setIdentityForm(prev => ({ ...prev, vision: e.target.value }))}
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{identityForm.vision.length}/1000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIdentityDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.brandIdentity.cancel')}
            </Button>
            <Button onClick={handleSaveIdentity} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.brandIdentity.saving') : t('brandProfile.dialogs.brandIdentity.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Facts Edit Dialog */}
      <Dialog open={showQuickFactsDialog} onOpenChange={setShowQuickFactsDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.quickFacts.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowQuickFactsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.quickFacts.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 px-4 max-h-[70vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Primary Language Combobox */}
              <div className="space-y-2">
                <Label>{t('brandProfile.dialogs.quickFacts.primaryLanguageLabel')}</Label>
                <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={languageOpen}
                      className="w-full justify-between"
                    >
                      {quickFactsForm.primaryLocale
                        ? (() => {
                          const selected = languages.find(l => l.code === quickFactsForm.primaryLocale)
                          return selected ? `${selected.flag} ${selected.name}` : quickFactsForm.primaryLocale
                        })()
                        : t('brandProfile.dialogs.quickFacts.selectLanguage')}
                      <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('brandProfile.dialogs.quickFacts.searchLanguage')} />
                      <CommandList>
                        <CommandEmpty>No language found.</CommandEmpty>
                        <CommandGroup>
                          {languages.map((lang) => (
                            <CommandItem
                              key={lang.code}
                              value={`${lang.name} ${lang.code}`}
                              onSelect={() => {
                                setQuickFactsForm(prev => ({ ...prev, primaryLocale: lang.code }))
                                setLanguageOpen(false)
                              }}
                            >
                              <IconCheck
                                className={`h-4 w-4 ${quickFactsForm.primaryLocale === lang.code ? "opacity-100" : "opacity-0"}`}
                              />
                              {lang.flag} {lang.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Timezone Combobox */}
              <div className="space-y-2">
                <Label>{t('brandProfile.dialogs.quickFacts.timezoneLabel')}</Label>
                <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={timezoneOpen}
                      className="w-full justify-between"
                    >
                      {quickFactsForm.timezone
                        ? (() => {
                          const selected = timezones.find(t => t.value === quickFactsForm.timezone)
                          return selected ? selected.label : quickFactsForm.timezone
                        })()
                        : t('brandProfile.dialogs.quickFacts.selectTimezone')}
                      <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('brandProfile.dialogs.quickFacts.searchTimezone')} />
                      <CommandList>
                        <CommandEmpty>No timezone found.</CommandEmpty>
                        <CommandGroup>
                          {timezones.map((tz) => (
                            <CommandItem
                              key={tz.value}
                              value={`${tz.label} ${tz.value}`}
                              onSelect={() => {
                                setQuickFactsForm(prev => ({ ...prev, timezone: tz.value }))
                                setTimezoneOpen(false)
                              }}
                            >
                              <IconCheck
                                className={`h-4 w-4 ${quickFactsForm.timezone === tz.value ? "opacity-100" : "opacity-0"}`}
                              />
                              {tz.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Industry Combobox */}
            <div className="space-y-2">
              <Label>{t('brandProfile.dialogs.quickFacts.industryLabel')}</Label>
              <Popover open={industryOpen} onOpenChange={setIndustryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={industryOpen}
                    className="w-full justify-between"
                  >
                    {quickFactsForm.industry || t('brandProfile.dialogs.quickFacts.selectIndustry')}
                    <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('brandProfile.dialogs.quickFacts.searchIndustry')} />
                    <CommandList>
                      <CommandEmpty>No industry found.</CommandEmpty>
                      <CommandGroup>
                        {industries.map((ind) => (
                          <CommandItem
                            key={ind}
                            value={ind}
                            onSelect={() => {
                              setQuickFactsForm(prev => ({ ...prev, industry: ind }))
                              setIndustryOpen(false)
                            }}
                          >
                            <IconCheck
                              className={`h-4 w-4 ${quickFactsForm.industry === ind ? "opacity-100" : "opacity-0"}`}
                            />
                            {ind}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Working Hours by Day */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('brandProfile.dialogs.quickFacts.workingHoursByDay')}</Label>
                <div className="text-xs text-muted-foreground">
                  {generateWorkingHoursSummary(quickFactsForm.workingHoursDetail)}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32">
                      <Checkbox
                        id={`day-${day}`}
                        checked={quickFactsForm.workingHoursDetail[day]?.isOpen ?? false}
                        onCheckedChange={(checked) => setQuickFactsForm(prev => ({
                          ...prev,
                          workingHoursDetail: {
                            ...prev.workingHoursDetail,
                            [day]: {
                              isOpen: checked as boolean,
                              startTime: checked ? (prev.workingHoursDetail[day]?.startTime || '09:00') : '',
                              endTime: checked ? (prev.workingHoursDetail[day]?.endTime || '18:00') : '',
                            },
                          },
                        }))}
                      />
                      <Label htmlFor={`day-${day}`} className="text-sm font-normal capitalize cursor-pointer">
                        {t(`brandProfile.dialogs.quickFacts.${day}`)}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1">
                        <IconClock className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={quickFactsForm.workingHoursDetail[day]?.startTime || ''}
                          onChange={(e) => setQuickFactsForm(prev => ({
                            ...prev,
                            workingHoursDetail: {
                              ...prev.workingHoursDetail,
                              [day]: {
                                ...prev.workingHoursDetail[day],
                                startTime: e.target.value,
                              },
                            },
                          }))}
                          disabled={!quickFactsForm.workingHoursDetail[day]?.isOpen}
                          className="pl-8"
                        />
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="relative flex-1">
                        <IconClock className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={quickFactsForm.workingHoursDetail[day]?.endTime || ''}
                          onChange={(e) => setQuickFactsForm(prev => ({
                            ...prev,
                            workingHoursDetail: {
                              ...prev.workingHoursDetail,
                              [day]: {
                                ...prev.workingHoursDetail[day],
                                endTime: e.target.value,
                              },
                            },
                          }))}
                          disabled={!quickFactsForm.workingHoursDetail[day]?.isOpen}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickFactsDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.quickFacts.cancel')}
            </Button>
            <Button onClick={handleSaveQuickFacts} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.quickFacts.saving') : t('brandProfile.dialogs.quickFacts.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Tone Characteristics Info Dialog */}
      <Dialog open={showToneInfo} onOpenChange={setShowToneInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.voice.toneCharacteristics.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.toneCharacteristics.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.voice.toneCharacteristics.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-xs mb-1">{t('brandProfile.voice.toneCharacteristics.infoDialog.formalInformal.title')}</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.formalInformal.left')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.formalInformal.right')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.formalInformal.middle')}</strong>
                </p>
              </div>

              <div>
                <h4 className="font-medium text-xs mb-1">{t('brandProfile.voice.toneCharacteristics.infoDialog.seriousPlayful.title')}</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.seriousPlayful.left')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.seriousPlayful.right')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.seriousPlayful.middle')}</strong>
                </p>
              </div>

              <div>
                <h4 className="font-medium text-xs mb-1">{t('brandProfile.voice.toneCharacteristics.infoDialog.simpleComplex.title')}</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.simpleComplex.left')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.simpleComplex.right')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.simpleComplex.middle')}</strong>
                </p>
              </div>

              <div>
                <h4 className="font-medium text-xs mb-1">{t('brandProfile.voice.toneCharacteristics.infoDialog.warmNeutral.title')}</h4>
                <p className="text-xs text-muted-foreground">
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.warmNeutral.left')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.warmNeutral.right')}</strong><br />
                  <strong>{t('brandProfile.voice.toneCharacteristics.infoDialog.warmNeutral.middle')}</strong>
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowToneInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Do Say Info Dialog */}
      <Dialog open={showDoSayInfo} onOpenChange={setShowDoSayInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.voice.doSay.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.doSay.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.voice.doSay.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.doSay.infoDialog.howToWrite.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.voice.doSay.infoDialog.howToWrite.point1')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.howToWrite.point2')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.howToWrite.point3')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.howToWrite.point4')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.doSay.infoDialog.examples.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.voice.doSay.infoDialog.examples.example1')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.examples.example2')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.examples.example3')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.examples.example4')}</li>
                <li>• {t('brandProfile.voice.doSay.infoDialog.examples.example5')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDoSayInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Don't Say Info Dialog */}
      <Dialog open={showDontSayInfo} onOpenChange={setShowDontSayInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.voice.dontSay.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.dontSay.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.voice.dontSay.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.dontSay.infoDialog.whatToAvoid.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.voice.dontSay.infoDialog.whatToAvoid.point1')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.whatToAvoid.point2')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.whatToAvoid.point3')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.whatToAvoid.point4')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.dontSay.infoDialog.examples.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.voice.dontSay.infoDialog.examples.example1')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.examples.example2')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.examples.example3')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.examples.example4')}</li>
                <li>• {t('brandProfile.voice.dontSay.infoDialog.examples.example5')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.voice.dontSay.infoDialog.whyMatters.title')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.voice.dontSay.infoDialog.whyMatters.description')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDontSayInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: Brand Colors Info Dialog */}
      <Dialog open={showBrandColorsInfo} onOpenChange={setShowBrandColorsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.assets.brandColors.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.brandColors.infoDialog.primaryColorsTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.brandColors.infoDialog.primaryColorsDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.brandColors.infoDialog.primaryColorsExamples')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>{t('brandProfile.assets.brandColors.infoDialog.primaryColorsTipLabel')}</strong> {t('brandProfile.assets.brandColors.infoDialog.primaryColorsTipValue')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.brandColors.infoDialog.accentColorsTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.brandColors.infoDialog.accentColorsDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.brandColors.infoDialog.accentColorsExamples')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>{t('brandProfile.assets.brandColors.infoDialog.accentColorsTipLabel')}</strong> {t('brandProfile.assets.brandColors.infoDialog.accentColorsTipValue')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.brandColors.infoDialog.howToUseTitle')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.assets.brandColors.infoDialog.howToUse1')}</li>
                <li>• {t('brandProfile.assets.brandColors.infoDialog.howToUse2')}</li>
                <li>• {t('brandProfile.assets.brandColors.infoDialog.howToUse3')}</li>
                <li>• {t('brandProfile.assets.brandColors.infoDialog.howToUse4')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowBrandColorsInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: Visual Guidelines Info Dialog */}
      <Dialog open={showVisualGuidelinesInfo} onOpenChange={setShowVisualGuidelinesInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.assets.visualGuidelines.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.visualGuidelines.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.visualGuidelines.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.point1')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.point2')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.point3')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.point4')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.whatToInclude.point5')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.visualGuidelines.infoDialog.examples.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example1')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example2')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example3')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example4')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example5')}</li>
                <li>• {t('brandProfile.assets.visualGuidelines.infoDialog.examples.example6')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.visualGuidelines.infoDialog.tipsTitle')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.visualGuidelines.infoDialog.tipsDescription')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowVisualGuidelinesInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: AI Configuration Info Dialog */}
      <Dialog open={showAiConfigInfo} onOpenChange={setShowAiConfigInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.assets.aiConfiguration.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.aiConfiguration.infoDialog.defaultLanguageTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.defaultLanguageDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.defaultLanguageExample')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.aiConfiguration.infoDialog.contentLengthTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.contentLengthDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>{t('brandProfile.assets.aiConfiguration.infoDialog.contentLengthCharsExample')}</strong><br />
                <strong>{t('brandProfile.assets.aiConfiguration.infoDialog.contentLengthWordsExample')}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('brandProfile.assets.aiConfiguration.infoDialog.contentLengthTip')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.aiConfiguration.infoDialog.ctaStyleTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.ctaStyleDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.ctaStyleExamples')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.assets.aiConfiguration.infoDialog.preferredPlatformsTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.preferredPlatformsDescription')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.assets.aiConfiguration.infoDialog.preferredPlatformsExamples')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('brandProfile.assets.aiConfiguration.infoDialog.preferredPlatformsTip')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowAiConfigInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Allowed Topics Info Dialog */}
      <Dialog open={showAllowedTopicsInfo} onOpenChange={setShowAllowedTopicsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.rules.allowedTopics.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.allowedTopics.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.rules.allowedTopics.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.allowedTopics.infoDialog.howToDefine.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.howToDefine.point1')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.howToDefine.point2')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.howToDefine.point3')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.howToDefine.point4')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.allowedTopics.infoDialog.examples.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example1')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example2')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example3')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example4')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example5')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example6')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example7')}</li>
                <li>• {t('brandProfile.rules.allowedTopics.infoDialog.examples.example8')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowAllowedTopicsInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Forbidden Topics Info Dialog */}
      <Dialog open={showForbiddenTopicsInfo} onOpenChange={setShowForbiddenTopicsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.rules.forbiddenTopics.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsDescription')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExamplesTitle')}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExample1')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExample2')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExample3')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExample4')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.forbiddenTopicsExample5')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesDescription')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesExamplesTitle')}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesExample1')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesExample2')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesExample3')}</li>
                <li>• {t('brandProfile.rules.forbiddenTopics.infoDialog.crisisGuidelinesExample4')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.forbiddenTopics.infoDialog.whyMattersTitle')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.rules.forbiddenTopics.infoDialog.whyMattersDescription')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowForbiddenTopicsInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Legal Constraints Info Dialog */}
      <Dialog open={showLegalConstraintInfo} onOpenChange={setShowLegalConstraintInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.rules.legalConstraints.infoDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.legalConstraints.infoDialog.whatAre')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.rules.legalConstraints.infoDialog.description')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.point1')}</li>
                <li>• {t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.point2')}</li>
                <li>• {t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.point3')}</li>
                <li>• {t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.point4')}</li>
                <li>• {t('brandProfile.rules.legalConstraints.infoDialog.whatToInclude.point5')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.legalConstraints.infoDialog.exampleTitle')}</h4>
              <p className="text-xs text-muted-foreground">
                <strong>{t('brandProfile.rules.legalConstraints.infoDialog.exampleTitleLabel')}</strong> <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.rules.legalConstraints.infoDialog.exampleTitleValue')}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>{t('brandProfile.rules.legalConstraints.infoDialog.exampleDescLabel')}</strong> <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.rules.legalConstraints.infoDialog.exampleDescValue')}</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.title')}</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><strong>{t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.copyrightLabel')}</strong> {t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.copyrightValue')}</li>
                <li><strong>{t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.gdprLabel')}</strong> {t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.gdprValue')}</li>
                <li><strong>{t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.medicalLabel')}</strong> {t('brandProfile.rules.legalConstraints.infoDialog.moreExamples.medicalValue')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowLegalConstraintInfo(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Facts Info Dialog */}
      <Dialog open={showQuickFactsInfo} onOpenChange={setShowQuickFactsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.dialogs.quickFacts.infoTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.quickFacts.infoPrimaryLanguageTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoPrimaryLanguageDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoPrimaryLanguageExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.quickFacts.infoPrimaryLanguageExamples')}</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.quickFacts.infoTimezoneTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoTimezoneDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoTimezoneExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.quickFacts.infoTimezoneExamples')}</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.quickFacts.infoIndustryTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoIndustryDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.quickFacts.infoWorkingHoursTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoWorkingHoursDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.quickFacts.infoWorkingHoursFormat')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowQuickFactsInfo(false)}>
              {t('brandProfile.dialogs.quickFacts.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Identity Info Dialog */}
      <Dialog open={showIdentityInfo} onOpenChange={setShowIdentityInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.dialogs.brandIdentity.infoTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.brandIdentity.infoTaglineTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoTaglineDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoTaglineExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.brandIdentity.infoTaglineExampleText')}</code>
              </p>
              <p className="text-xs text-muted-foreground">{t('brandProfile.dialogs.brandIdentity.infoTaglineMax')}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.brandIdentity.infoMissionTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoMissionDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoMissionExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.brandIdentity.infoMissionExampleText')}</code>
              </p>
              <p className="text-xs text-muted-foreground">{t('brandProfile.dialogs.brandIdentity.infoMissionMax')}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.brandIdentity.infoVisionTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoVisionDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.brandIdentity.infoVisionExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.brandIdentity.infoVisionExampleText')}</code>
              </p>
              <p className="text-xs text-muted-foreground">{t('brandProfile.dialogs.brandIdentity.infoVisionMax')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowIdentityInfo(false)}>
              {t('brandProfile.dialogs.brandIdentity.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Channel Info Dialog */}
      <Dialog open={showContactInfo} onOpenChange={setShowContactInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('brandProfile.dialogs.contactChannel.infoTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.contactChannel.infoTypesTitle')}</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>{t('brandProfile.dialogs.contactChannel.infoTypePhone')}</li>
                <li>{t('brandProfile.dialogs.contactChannel.infoTypeWhatsapp')}</li>
                <li>{t('brandProfile.dialogs.contactChannel.infoTypeEmail')}</li>
                <li>{t('brandProfile.dialogs.contactChannel.infoTypeWebsite')}</li>
                <li>{t('brandProfile.dialogs.contactChannel.infoTypeAddress')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.contactChannel.infoLabelTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.contactChannel.infoLabelDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('brandProfile.dialogs.contactChannel.infoLabelExample')} <code className="px-1 py-0.5 bg-muted rounded">{t('brandProfile.dialogs.contactChannel.infoLabelExamples')}</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">{t('brandProfile.dialogs.contactChannel.infoPrimaryTitle')}</h4>
              <p className="text-muted-foreground">
                {t('brandProfile.dialogs.contactChannel.infoPrimaryDesc')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowContactInfo(false)}>
              {t('brandProfile.dialogs.contactChannel.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Overview Info Dialog */}
      <Dialog open={showBusinessOverviewInfo} onOpenChange={setShowBusinessOverviewInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Business Overview Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Business Type</h4>
              <p className="text-muted-foreground">
                Choose what you primarily offer to customers.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><strong>Service:</strong> You provide services (consulting, design, development)</li>
                <li><strong>Product:</strong> You sell physical or digital products</li>
                <li><strong>Both:</strong> You offer both services and products</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Market Type</h4>
              <p className="text-muted-foreground">
                Define your target customer base.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><strong>B2B:</strong> Selling to other businesses</li>
                <li><strong>B2C:</strong> Selling directly to consumers</li>
                <li><strong>B2B2C:</strong> Both business and consumer markets</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Delivery Model</h4>
              <p className="text-muted-foreground">
                How you deliver your service/product to customers.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 bg-muted rounded">Online & On-site</code>, <code className="px-1 py-0.5 bg-muted rounded">Digital Download</code>, <code className="px-1 py-0.5 bg-muted rounded">Subscription</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowBusinessOverviewInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Core Offerings Info Dialog */}
      <Dialog open={showCoreOfferingsInfo} onOpenChange={setShowCoreOfferingsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Core Offerings Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Core Services</h4>
              <p className="text-muted-foreground">
                List the main services your brand provides. Be specific and clear.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Social media management</li>
                <li>• Performance marketing</li>
                <li>• UX/UI design</li>
                <li>• Content strategy</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Core Products</h4>
              <p className="text-muted-foreground">
                List the main products your brand sells or offers.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Analytics dashboards</li>
                <li>• Automation templates</li>
                <li>• Brand guideline kits</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Tips</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Keep each item concise (1-3 words)</li>
                <li>• Focus on what makes you unique</li>
                <li>• Order by importance</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowCoreOfferingsInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Channels Info Dialog */}
      <Dialog open={showSalesChannelsInfo} onOpenChange={setShowSalesChannelsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sales & Service Channels Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Sales Channels</h4>
              <p className="text-muted-foreground">
                How do customers find and purchase from you?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Website</li>
                <li>• Email & WhatsApp</li>
                <li>• Partner agencies</li>
                <li>• Direct outreach</li>
                <li>• Social media</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Transaction Types</h4>
              <p className="text-muted-foreground">
                What are your pricing and payment models?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Project-based</li>
                <li>• Retainer</li>
                <li>• Subscription</li>
                <li>• Hybrid packages</li>
                <li>• One-time purchase</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSalesChannelsInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persona Info Dialog */}
      <Dialog open={showPersonaInfo} onOpenChange={setShowPersonaInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Audience Persona Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Persona Name</h4>
              <p className="text-muted-foreground">
                Give your persona a descriptive, memorable name.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 bg-muted rounded">Tech-Savvy Professional</code>, <code className="px-1 py-0.5 bg-muted rounded">Creative Entrepreneur</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Age Range</h4>
              <p className="text-muted-foreground">
                Select the age range this persona represents. Choose starting and ending age.
              </p>
              <p className="text-xs text-muted-foreground">
                Example: From <strong>28</strong> To <strong>45</strong> → Saved as "28-45"
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Description</h4>
              <p className="text-muted-foreground">
                Brief description of this persona&apos;s characteristics, goals, or behavior.
              </p>
              <p className="text-xs text-muted-foreground">
                Example: <code className="px-1 py-0.5 bg-muted rounded">Urban professional seeking efficiency and reliability</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Pain Points</h4>
              <p className="text-muted-foreground">
                What challenges or frustrations does this persona face?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 bg-muted rounded">Time constraints</code>, <code className="px-1 py-0.5 bg-muted rounded">Info overload</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPersonaInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Positioning Info Dialog */}
      <Dialog open={showPositioningInfo} onOpenChange={setShowPositioningInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Positioning Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Category</h4>
              <p className="text-muted-foreground">
                How do you categorize or describe your brand in the market?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 bg-muted rounded">Digital Experience Studio</code>, <code className="px-1 py-0.5 bg-muted rounded">Premium Lifestyle Brand</code>, <code className="px-1 py-0.5 bg-muted rounded">Enterprise SaaS Platform</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Unique Selling Points (USPs)</h4>
              <p className="text-muted-foreground">
                What makes your brand unique and better than alternatives?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Cutting-edge technology</li>
                <li>• Human-centered design approach</li>
                <li>• End-to-end solutions</li>
                <li>• 24/7 customer support</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Tips:</strong> Be specific, focus on real differentiators, keep each USP concise.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPositioningInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Competitor Info Dialog */}
      <Dialog open={showCompetitorInfo} onOpenChange={setShowCompetitorInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Competitor Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Competitor Name</h4>
              <p className="text-muted-foreground">
                Enter the name of a competing brand or business.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 bg-muted rounded">Acme Digital</code>, <code className="px-1 py-0.5 bg-muted rounded">Creative Studio X</code>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Note</h4>
              <p className="text-muted-foreground">
                What makes them different? What are their strengths or weaknesses?
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Enterprise focus, less creative</li>
                <li>• Strong design, weaker on tech</li>
                <li>• Lower prices but slower delivery</li>
                <li>• Great customer service, limited portfolio</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Tip:</strong> Focus on key differentiators that help you position yourself better.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowCompetitorInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Regions Info Dialog */}
      <Dialog open={showServiceRegionsInfo} onOpenChange={setShowServiceRegionsInfo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Service Regions & Structure Guide</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Structure Type</h4>
              <p className="text-muted-foreground">
                How is your business organized physically?
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li><strong>Single-location:</strong> One physical office/shop</li>
                <li><strong>Multi-branch:</strong> Multiple owned locations</li>
                <li><strong>Franchise:</strong> Franchised business model</li>
                <li><strong>Online-only:</strong> No physical presence</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">HQ Location</h4>
              <p className="text-muted-foreground">
                Your headquarters or main office location.
              </p>
              <p className="text-xs text-muted-foreground">
                First select country, then city from the dropdown.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Service Regions</h4>
              <p className="text-muted-foreground">
                Geographic areas where you operate or provide services.
              </p>
              <p className="text-xs text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                <li>• Turkey (primary: Marmara region)</li>
                <li>• Europe (select projects)</li>
                <li>• North America</li>
                <li>• MENA region</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowServiceRegionsInfo(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Overview Edit Dialog */}
      <Dialog open={showBusinessOverviewDialog} onOpenChange={setShowBusinessOverviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.businessOverview.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowBusinessOverviewInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.businessOverview.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label>{t('brandProfile.dialogs.businessOverview.businessTypeLabel')}</Label>
              <Select
                value={businessOverviewForm.businessType}
                onValueChange={(value: 'Service' | 'Product' | 'Both') => setBusinessOverviewForm(prev => ({ ...prev, businessType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('brandProfile.dialogs.businessOverview.selectBusinessType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Service">{t('brandProfile.dialogs.businessOverview.service')}</SelectItem>
                  <SelectItem value="Product">{t('brandProfile.dialogs.businessOverview.product')}</SelectItem>
                  <SelectItem value="Both">{t('brandProfile.dialogs.businessOverview.both')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('brandProfile.dialogs.businessOverview.marketTypeLabel')}</Label>
              <Select
                value={businessOverviewForm.marketType}
                onValueChange={(value: 'B2B' | 'B2C' | 'B2B2C') => setBusinessOverviewForm(prev => ({ ...prev, marketType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('brandProfile.dialogs.businessOverview.selectMarketType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                  <SelectItem value="B2B2C">B2B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-delivery">{t('brandProfile.dialogs.businessOverview.deliveryModelLabel')}</Label>
              <Input
                id="business-delivery"
                placeholder={t('brandProfile.dialogs.businessOverview.deliveryModelPlaceholder')}
                value={businessOverviewForm.deliveryModel}
                onChange={(e) => setBusinessOverviewForm(prev => ({ ...prev, deliveryModel: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBusinessOverviewDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.businessOverview.cancel')}
            </Button>
            <Button onClick={handleSaveBusinessOverview} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.businessOverview.saving') : t('brandProfile.dialogs.businessOverview.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Core Offerings Edit Dialog */}
      <Dialog open={showCoreOfferingsDialog} onOpenChange={setShowCoreOfferingsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.coreOfferings.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCoreOfferingsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.coreOfferings.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            {/* Core Services */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.dialogs.coreOfferings.coreServicesLabel')}</Label>
              <div className="space-y-2">
                {coreOfferingsForm.coreServices.map((service, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm p-2 bg-muted rounded-md">{service}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveService(idx)}>
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('brandProfile.dialogs.coreOfferings.coreServicesPlaceholder')}
                    value={coreOfferingsForm.newService}
                    onChange={(e) => setCoreOfferingsForm(prev => ({ ...prev, newService: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddService())}
                  />
                  <Button variant="outline" size="icon" onClick={handleAddService}>
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Core Products */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.dialogs.coreOfferings.coreProductsLabel')}</Label>
              <div className="space-y-2">
                {coreOfferingsForm.coreProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm p-2 bg-muted rounded-md">{product}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveProduct(idx)}>
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('brandProfile.dialogs.coreOfferings.coreProductsPlaceholder')}
                    value={coreOfferingsForm.newProduct}
                    onChange={(e) => setCoreOfferingsForm(prev => ({ ...prev, newProduct: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddProduct())}
                  />
                  <Button variant="outline" size="icon" onClick={handleAddProduct}>
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCoreOfferingsDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.coreOfferings.cancel')}
            </Button>
            <Button onClick={handleSaveCoreOfferings} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.coreOfferings.saving') : t('brandProfile.dialogs.coreOfferings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Channels Edit Dialog */}
      <Dialog open={showSalesChannelsDialog} onOpenChange={setShowSalesChannelsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.salesChannels.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSalesChannelsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.salesChannels.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            {/* Sales Channels */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.dialogs.salesChannels.salesChannelsLabel')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {salesChannelsForm.salesChannels.map((channel, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {channel}
                    <button
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={() => handleRemoveSalesChannel(idx)}
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.dialogs.salesChannels.salesChannelsPlaceholder')}
                  value={salesChannelsForm.newChannel}
                  onChange={(e) => setSalesChannelsForm(prev => ({ ...prev, newChannel: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSalesChannel())}
                />
                <Button variant="outline" size="icon" onClick={handleAddSalesChannel}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Transaction Types */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.dialogs.salesChannels.transactionTypesLabel')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {salesChannelsForm.transactionTypes.map((type, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {type}
                    <button
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={() => handleRemoveTransactionType(idx)}
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.dialogs.salesChannels.transactionTypesPlaceholder')}
                  value={salesChannelsForm.newType}
                  onChange={(e) => setSalesChannelsForm(prev => ({ ...prev, newType: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTransactionType())}
                />
                <Button variant="outline" size="icon" onClick={handleAddTransactionType}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalesChannelsDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.salesChannels.cancel')}
            </Button>
            <Button onClick={handleSaveSalesChannels} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.salesChannels.saving') : t('brandProfile.dialogs.salesChannels.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Regions Edit Dialog */}
      <Dialog open={showServiceRegionsDialog} onOpenChange={setShowServiceRegionsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.dialogs.serviceRegions.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowServiceRegionsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.dialogs.serviceRegions.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label>{t('brandProfile.dialogs.serviceRegions.structureTypeLabel')}</Label>
              <Select
                value={serviceRegionsForm.structureType}
                onValueChange={(value: 'Single-location' | 'Multi-branch' | 'Franchise' | 'Online-only') => setServiceRegionsForm(prev => ({ ...prev, structureType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('brandProfile.dialogs.serviceRegions.selectStructureType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single-location">{t('brandProfile.dialogs.serviceRegions.singleLocation')}</SelectItem>
                  <SelectItem value="Multi-branch">{t('brandProfile.dialogs.serviceRegions.multiBranch')}</SelectItem>
                  <SelectItem value="Franchise">{t('brandProfile.dialogs.serviceRegions.franchise')}</SelectItem>
                  <SelectItem value="Online-only">{t('brandProfile.dialogs.serviceRegions.onlineOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HQ Location: Country + City */}
            <div className="space-y-3">
              <Label>{t('brandProfile.dialogs.serviceRegions.hqLocationLabel')}</Label>
              <div className="grid gap-2 grid-cols-2">
                {/* Country */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('brandProfile.dialogs.serviceRegions.countryLabel')}</Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="w-full justify-between"
                      >
                        {serviceRegionsForm.hqCountry
                          ? (() => {
                            const selected = countriesData.find(c => c.code === serviceRegionsForm.hqCountry)
                            return selected ? `${selected.flag} ${selected.name}` : serviceRegionsForm.hqCountry
                          })()
                          : t('brandProfile.dialogs.serviceRegions.selectCountry')}
                        <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('brandProfile.dialogs.serviceRegions.searchCountry')} />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {countriesData.map((country) => (
                              <CommandItem
                                key={country.code}
                                value={`${country.name} ${country.code}`}
                                onSelect={() => handleCountryChange(country.code)}
                              >
                                <IconCheck
                                  className={`h-4 w-4 ${serviceRegionsForm.hqCountry === country.code ? "opacity-100" : "opacity-0"}`}
                                />
                                {country.flag} {country.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('brandProfile.dialogs.serviceRegions.cityLabel')}</Label>
                  <Popover open={cityOpen} onOpenChange={setCityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={cityOpen}
                        className="w-full justify-between"
                        disabled={!serviceRegionsForm.hqCountry}
                      >
                        {serviceRegionsForm.hqCity || t('brandProfile.dialogs.serviceRegions.selectCity')}
                        <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('brandProfile.dialogs.serviceRegions.searchCity')} />
                        <CommandList>
                          <CommandEmpty>No city found.</CommandEmpty>
                          <CommandGroup>
                            {cities.map((city) => (
                              <CommandItem
                                key={city}
                                value={city}
                                onSelect={() => {
                                  setServiceRegionsForm(prev => ({ ...prev, hqCity: city }))
                                  setCityOpen(false)
                                }}
                              >
                                <IconCheck
                                  className={`h-4 w-4 ${serviceRegionsForm.hqCity === city ? "opacity-100" : "opacity-0"}`}
                                />
                                {city}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.dialogs.serviceRegions.serviceRegionsLabel')}</Label>
              <div className="space-y-2">
                {serviceRegionsForm.serviceRegions.map((region, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm p-2 bg-muted rounded-md">{region}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveServiceRegion(idx)}>
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('brandProfile.dialogs.serviceRegions.addRegion')}
                    value={serviceRegionsForm.newRegion}
                    onChange={(e) => setServiceRegionsForm(prev => ({ ...prev, newRegion: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddServiceRegion())}
                  />
                  <Button variant="outline" size="icon" onClick={handleAddServiceRegion}>
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceRegionsDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.dialogs.serviceRegions.cancel')}
            </Button>
            <Button onClick={handleSaveServiceRegions} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.dialogs.serviceRegions.saving') : t('brandProfile.dialogs.serviceRegions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persona Edit Dialog */}
      <Dialog open={showPersonaDialog} onOpenChange={setShowPersonaDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{editingPersona ? t('brandProfile.persona.titleEdit') : t('brandProfile.persona.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPersonaInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {editingPersona ? t('brandProfile.persona.descriptionEdit') : t('brandProfile.persona.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="persona-name">{t('brandProfile.persona.nameLabel')} *</Label>
              <Input
                id="persona-name"
                placeholder={t('brandProfile.persona.namePlaceholder')}
                value={personaForm.name}
                onChange={(e) => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('brandProfile.persona.ageRangeLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('brandProfile.persona.ageFrom')}</Label>
                  <Select
                    value={personaForm.ageStart}
                    onValueChange={(value) => setPersonaForm(prev => ({ ...prev, ageStart: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('brandProfile.persona.agePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ageOptions.map((age) => (
                        <SelectItem key={age} value={age}>
                          {age}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('brandProfile.persona.ageTo')}</Label>
                  <Select
                    value={personaForm.ageEnd}
                    onValueChange={(value) => setPersonaForm(prev => ({ ...prev, ageEnd: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('brandProfile.persona.agePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ageOptions.map((age) => (
                        <SelectItem key={age} value={age}>
                          {age}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-description">{t('brandProfile.persona.descriptionLabel')}</Label>
              <Textarea
                id="persona-description"
                placeholder={t('brandProfile.persona.descriptionPlaceholder')}
                value={personaForm.description}
                onChange={(e) => setPersonaForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.persona.painPointsLabel')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {personaForm.painPoints.map((point, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1 pr-1">
                    {point}
                    <button
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={() => handleRemovePainPoint(idx)}
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.persona.addPainPoint')}
                  value={personaForm.newPainPoint}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, newPainPoint: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPainPoint())}
                />
                <Button variant="outline" size="icon" onClick={handleAddPainPoint}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPersonaDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.persona.cancel')}
            </Button>
            <Button onClick={handleSavePersona} disabled={isProfileSaving || !personaForm.name.trim()}>
              {isProfileSaving ? t('brandProfile.persona.saving') : editingPersona ? t('brandProfile.persona.update') : t('brandProfile.persona.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Positioning Edit Dialog */}
      <Dialog open={showPositioningDialog} onOpenChange={setShowPositioningDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.positioning.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPositioningInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.positioning.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="positioning-category">{t('brandProfile.positioning.categoryLabel')}</Label>
              <Input
                id="positioning-category"
                placeholder={t('brandProfile.positioning.categoryPlaceholder')}
                value={positioningForm.category}
                onChange={(e) => setPositioningForm(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.positioning.uspsLabel')}</Label>
              <div className="space-y-2 mb-2">
                {positioningForm.usps.map((usp, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                    <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="flex-1 text-sm">{usp}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveUsp(idx)}>
                      <IconX className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.positioning.addUsp')}
                  value={positioningForm.newUsp}
                  onChange={(e) => setPositioningForm(prev => ({ ...prev, newUsp: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUsp())}
                />
                <Button variant="outline" size="icon" onClick={handleAddUsp}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPositioningDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.positioning.cancel')}
            </Button>
            <Button onClick={handleSavePositioning} disabled={isProfileSaving}>
              {isProfileSaving ? t('brandProfile.positioning.saving') : t('brandProfile.positioning.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Competitor Edit Dialog */}
      <Dialog open={showCompetitorDialog} onOpenChange={setShowCompetitorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{editingCompetitor ? t('brandProfile.competitor.titleEdit') : t('brandProfile.competitor.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCompetitorInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {editingCompetitor ? t('brandProfile.competitor.descriptionEdit') : t('brandProfile.competitor.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="competitor-name">{t('brandProfile.competitor.nameLabel')} *</Label>
              <Input
                id="competitor-name"
                placeholder={t('brandProfile.competitor.namePlaceholder')}
                value={competitorForm.name}
                onChange={(e) => setCompetitorForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitor-note">{t('brandProfile.competitor.noteLabel')}</Label>
              <Textarea
                id="competitor-note"
                placeholder={t('brandProfile.competitor.notePlaceholder')}
                value={competitorForm.note}
                onChange={(e) => setCompetitorForm(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
                maxLength={300}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompetitorDialog(false)} disabled={isProfileSaving}>
              {t('brandProfile.competitor.cancel')}
            </Button>
            <Button onClick={handleSaveCompetitor} disabled={isProfileSaving || !competitorForm.name.trim()}>
              {isProfileSaving ? t('brandProfile.competitor.saving') : editingCompetitor ? t('brandProfile.competitor.update') : t('brandProfile.competitor.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Tone Characteristics Edit Dialog */}
      <Dialog open={showToneDialog} onOpenChange={setShowToneDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.voice.toneCharacteristics.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowToneInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.voice.toneCharacteristics.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 px-4">{/* px-4 for proper focus ring space */}
            {/* Formal - Informal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.formal')}</span>
                <span className="font-medium">{Math.round(toneForm.formalInformal * 100)}%</span>
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.informal')}</span>
              </div>
              <Slider
                value={[toneForm.formalInformal * 100]}
                onValueChange={([value]) => setToneForm(prev => ({ ...prev, formalInformal: value / 100 }))}
                max={100}
                step={1}
              />
            </div>

            {/* Serious - Playful */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.serious')}</span>
                <span className="font-medium">{Math.round(toneForm.seriousPlayful * 100)}%</span>
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.playful')}</span>
              </div>
              <Slider
                value={[toneForm.seriousPlayful * 100]}
                onValueChange={([value]) => setToneForm(prev => ({ ...prev, seriousPlayful: value / 100 }))}
                max={100}
                step={1}
              />
            </div>

            {/* Simple - Complex */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.simple')}</span>
                <span className="font-medium">{Math.round(toneForm.simpleComplex * 100)}%</span>
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.complex')}</span>
              </div>
              <Slider
                value={[toneForm.simpleComplex * 100]}
                onValueChange={([value]) => setToneForm(prev => ({ ...prev, simpleComplex: value / 100 }))}
                max={100}
                step={1}
              />
            </div>

            {/* Warm - Neutral */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.warm')}</span>
                <span className="font-medium">{Math.round(toneForm.warmNeutral * 100)}%</span>
                <span className="text-muted-foreground">{t('brandProfile.voice.toneCharacteristics.neutral')}</span>
              </div>
              <Slider
                value={[toneForm.warmNeutral * 100]}
                onValueChange={([value]) => setToneForm(prev => ({ ...prev, warmNeutral: value / 100 }))}
                max={100}
                step={1}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToneDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveTone} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Do Say Edit Dialog */}
      <Dialog open={showDoSayDialog} onOpenChange={setShowDoSayDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.voice.doSay.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDoSayInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.voice.doSay.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              {doSayForm.doSay.map((phrase, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm group hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                  <span>&quot;{phrase}&quot;</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-100"
                    onClick={() => handleRemoveDoSay(idx)}
                  >
                    <IconX className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {doSayForm.doSay.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('brandProfile.voice.doSay.editDialog.emptyState')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosay-phrase">{t('brandProfile.voice.doSay.editDialog.addNewLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="dosay-phrase"
                  placeholder={t('brandProfile.voice.doSay.editDialog.placeholder')}
                  value={doSayForm.newPhrase}
                  onChange={(e) => setDoSayForm(prev => ({ ...prev, newPhrase: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDoSay())}
                  maxLength={300}
                />
                <Button variant="outline" size="icon" onClick={handleAddDoSay}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDoSayDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveDoSay} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice: Don't Say Edit Dialog */}
      <Dialog open={showDontSayDialog} onOpenChange={setShowDontSayDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.voice.dontSay.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDontSayInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.voice.dontSay.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              {dontSayForm.dontSay.map((phrase, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                  <span>&quot;{phrase}&quot;</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-100"
                    onClick={() => handleRemoveDontSay(idx)}
                  >
                    <IconX className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {dontSayForm.dontSay.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('brandProfile.voice.dontSay.editDialog.emptyState')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dontsay-phrase">{t('brandProfile.voice.dontSay.editDialog.addNewLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="dontsay-phrase"
                  placeholder={t('brandProfile.voice.dontSay.editDialog.placeholder')}
                  value={dontSayForm.newPhrase}
                  onChange={(e) => setDontSayForm(prev => ({ ...prev, newPhrase: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDontSay())}
                  maxLength={300}
                />
                <Button variant="outline" size="icon" onClick={handleAddDontSay}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDontSayDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveDontSay} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Allowed Topics Edit Dialog */}
      <Dialog open={showAllowedTopicsDialog} onOpenChange={setShowAllowedTopicsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.rules.allowedTopics.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAllowedTopicsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.rules.allowedTopics.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {allowedTopicsForm.topics.map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {topic}
                    <button
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={() => handleRemoveAllowedTopic(idx)}
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              {allowedTopicsForm.topics.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('brandProfile.rules.allowedTopics.editDialog.emptyState')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowed-topic">{t('brandProfile.rules.allowedTopics.editDialog.addNewLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="allowed-topic"
                  placeholder={t('brandProfile.rules.allowedTopics.editDialog.placeholder')}
                  value={allowedTopicsForm.newTopic}
                  onChange={(e) => setAllowedTopicsForm(prev => ({ ...prev, newTopic: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllowedTopic())}
                  maxLength={200}
                />
                <Button variant="outline" size="icon" onClick={handleAddAllowedTopic}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllowedTopicsDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAllowedTopics} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Forbidden Topics & Crisis Guidelines Edit Dialog */}
      <Dialog open={showForbiddenTopicsDialog} onOpenChange={setShowForbiddenTopicsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.rules.forbiddenTopics.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForbiddenTopicsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.rules.forbiddenTopics.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            {/* Forbidden Topics */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.rules.forbiddenTopics.editDialog.topicsToAvoidLabel')}</Label>
              <div className="space-y-2">
                {forbiddenTopicsForm.topics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                    <span className="flex items-center gap-2">
                      <IconX className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      {topic}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-100"
                      onClick={() => handleRemoveForbiddenTopic(idx)}
                    >
                      <IconX className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {forbiddenTopicsForm.topics.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('brandProfile.rules.forbiddenTopics.editDialog.topicsEmptyState')}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.rules.forbiddenTopics.editDialog.topicsPlaceholder')}
                  value={forbiddenTopicsForm.newTopic}
                  onChange={(e) => setForbiddenTopicsForm(prev => ({ ...prev, newTopic: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddForbiddenTopic())}
                  maxLength={200}
                />
                <Button variant="outline" size="icon" onClick={handleAddForbiddenTopic}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Crisis Guidelines */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">{t('brandProfile.rules.forbiddenTopics.editDialog.crisisGuidelinesLabel')}</Label>
              <div className="space-y-2">
                {forbiddenTopicsForm.crisisGuidelines.map((guideline, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm group hover:bg-muted transition-colors">
                    <span className="text-xs">• {guideline}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-100"
                      onClick={() => handleRemoveCrisisGuideline(idx)}
                    >
                      <IconX className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {forbiddenTopicsForm.crisisGuidelines.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('brandProfile.rules.forbiddenTopics.editDialog.crisisEmptyState')}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.rules.forbiddenTopics.editDialog.crisisPlaceholder')}
                  value={forbiddenTopicsForm.newGuideline}
                  onChange={(e) => setForbiddenTopicsForm(prev => ({ ...prev, newGuideline: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCrisisGuideline())}
                  maxLength={300}
                />
                <Button variant="outline" size="icon" onClick={handleAddCrisisGuideline}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForbiddenTopicsDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveForbiddenTopics} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules: Legal Constraint Edit Dialog */}
      <Dialog open={showLegalConstraintDialog} onOpenChange={setShowLegalConstraintDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{editingLegalConstraint ? t('brandProfile.rules.legalConstraints.editDialog.titleEdit') : t('brandProfile.rules.legalConstraints.editDialog.titleAdd')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLegalConstraintInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {editingLegalConstraint ? t('brandProfile.rules.legalConstraints.editDialog.descriptionEdit') : t('brandProfile.rules.legalConstraints.editDialog.descriptionAdd')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="legal-title">{t('brandProfile.rules.legalConstraints.editDialog.titleLabel')}</Label>
              <Input
                id="legal-title"
                placeholder={t('brandProfile.rules.legalConstraints.editDialog.titlePlaceholder')}
                value={legalConstraintForm.title}
                onChange={(e) => setLegalConstraintForm(prev => ({ ...prev, title: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal-description">{t('brandProfile.rules.legalConstraints.editDialog.descriptionLabel')}</Label>
              <Textarea
                id="legal-description"
                placeholder={t('brandProfile.rules.legalConstraints.editDialog.descriptionPlaceholder')}
                value={legalConstraintForm.description}
                onChange={(e) => setLegalConstraintForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{legalConstraintForm.description.length}/1000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLegalConstraintDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveLegalConstraint} disabled={isProfileSaving || !legalConstraintForm.title.trim()}>
              {isProfileSaving ? t('common.saving') : editingLegalConstraint ? t('brandProfile.rules.legalConstraints.editDialog.update') : t('brandProfile.rules.legalConstraints.editDialog.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: Brand Colors Edit Dialog */}
      <Dialog open={showBrandColorsDialog} onOpenChange={setShowBrandColorsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.assets.brandColors.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowBrandColorsInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.assets.brandColors.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Colors Column */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('brandProfile.assets.brandColors.editDialog.primaryColorsLabel')}</Label>
                <div className="flex flex-wrap gap-3 mb-3 min-h-[100px]">
                  {brandColorsForm.primary.map((color, idx) => (
                    <div key={idx} className="relative group">
                      <ColorPicker
                        value={color}
                        onValueChange={(newColor) => {
                          setBrandColorsForm(prev => ({
                            ...prev,
                            primary: prev.primary.map((c, i) => i === idx ? newColor : c)
                          }))
                        }}
                      >
                        <ColorPickerTrigger asChild>
                          <button className="block">
                            <div
                              className="h-16 w-16 rounded-lg border-2 border-muted transition-all hover:scale-105 hover:border-foreground/20 cursor-pointer"
                              style={{ backgroundColor: color }}
                            />
                            <span className="block text-xs text-muted-foreground text-center mt-1 font-mono">{color}</span>
                          </button>
                        </ColorPickerTrigger>
                        <ColorPickerContent>
                          <ColorPickerArea />
                          <ColorPickerHueSlider />
                          <ColorPickerInput />
                        </ColorPickerContent>
                      </ColorPicker>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePrimaryColor(idx)
                        }}
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-xs mb-2 block">{t('brandProfile.assets.brandColors.editDialog.addPrimaryColor')}</Label>
                  <div className="flex items-center gap-2">
                    <ColorPicker value={brandColorsForm.newPrimary} onValueChange={(color) => setBrandColorsForm(prev => ({ ...prev, newPrimary: color }))}>
                      <ColorPickerTrigger asChild>
                        <Button variant="outline" className="h-10 px-3 flex items-center gap-2 flex-1">
                          <div
                            className="h-6 w-6 rounded border shrink-0"
                            style={{ backgroundColor: brandColorsForm.newPrimary }}
                          />
                          <span className="text-sm font-mono truncate">{brandColorsForm.newPrimary}</span>
                        </Button>
                      </ColorPickerTrigger>
                      <ColorPickerContent>
                        <ColorPickerArea />
                        <ColorPickerHueSlider />
                        <ColorPickerInput />
                      </ColorPickerContent>
                    </ColorPicker>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleAddPrimaryColor}>
                      <IconPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Accent Colors Column */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('brandProfile.assets.brandColors.editDialog.accentColorsLabel')}</Label>
                <div className="flex flex-wrap gap-3 mb-3 min-h-[100px]">
                  {brandColorsForm.accent.map((color, idx) => (
                    <div key={idx} className="relative group">
                      <ColorPicker
                        value={color}
                        onValueChange={(newColor) => {
                          setBrandColorsForm(prev => ({
                            ...prev,
                            accent: prev.accent.map((c, i) => i === idx ? newColor : c)
                          }))
                        }}
                      >
                        <ColorPickerTrigger asChild>
                          <button className="block">
                            <div
                              className="h-16 w-16 rounded-lg border-2 border-muted transition-all hover:scale-105 hover:border-foreground/20 cursor-pointer"
                              style={{ backgroundColor: color }}
                            />
                            <span className="block text-xs text-muted-foreground text-center mt-1 font-mono">{color}</span>
                          </button>
                        </ColorPickerTrigger>
                        <ColorPickerContent>
                          <ColorPickerArea />
                          <ColorPickerHueSlider />
                          <ColorPickerInput />
                        </ColorPickerContent>
                      </ColorPicker>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveAccentColor(idx)
                        }}
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-xs mb-2 block">{t('brandProfile.assets.brandColors.editDialog.addAccentColor')}</Label>
                  <div className="flex items-center gap-2">
                    <ColorPicker value={brandColorsForm.newAccent} onValueChange={(color) => setBrandColorsForm(prev => ({ ...prev, newAccent: color }))}>
                      <ColorPickerTrigger asChild>
                        <Button variant="outline" className="h-10 px-3 flex items-center gap-2 flex-1">
                          <div
                            className="h-6 w-6 rounded border shrink-0"
                            style={{ backgroundColor: brandColorsForm.newAccent }}
                          />
                          <span className="text-sm font-mono truncate">{brandColorsForm.newAccent}</span>
                        </Button>
                      </ColorPickerTrigger>
                      <ColorPickerContent>
                        <ColorPickerArea />
                        <ColorPickerHueSlider />
                        <ColorPickerInput />
                      </ColorPickerContent>
                    </ColorPicker>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleAddAccentColor}>
                      <IconPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBrandColorsDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveBrandColors} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: Visual Guidelines Edit Dialog */}
      <Dialog open={showVisualGuidelinesDialog} onOpenChange={setShowVisualGuidelinesDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.assets.visualGuidelines.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowVisualGuidelinesInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.assets.visualGuidelines.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              {visualGuidelinesForm.guidelines.map((guideline, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                  <IconCheck className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="flex-1 text-sm">{guideline}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-100"
                    onClick={() => handleRemoveVisualGuideline(idx)}
                  >
                    <IconX className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {visualGuidelinesForm.guidelines.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('brandProfile.assets.visualGuidelines.editDialog.emptyState')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="visual-guideline">{t('brandProfile.assets.visualGuidelines.editDialog.addNewLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="visual-guideline"
                  placeholder={t('brandProfile.assets.visualGuidelines.editDialog.placeholder')}
                  value={visualGuidelinesForm.newGuideline}
                  onChange={(e) => setVisualGuidelinesForm(prev => ({ ...prev, newGuideline: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVisualGuideline())}
                  maxLength={300}
                />
                <Button variant="outline" size="icon" onClick={handleAddVisualGuideline}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisualGuidelinesDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveVisualGuidelines} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets: AI Configuration Edit Dialog */}
      <Dialog open={showAiConfigDialog} onOpenChange={setShowAiConfigDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>{t('brandProfile.assets.aiConfiguration.editDialog.title')}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAiConfigInfo(true)}>
                <IconInfoCircle className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="mt-0">
              {t('brandProfile.assets.aiConfiguration.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-4 max-h-[60vh] overflow-y-auto">{/* px-4 for proper focus ring space */}
            <div className="space-y-2">
              <Label htmlFor="ai-language">{t('brandProfile.assets.aiConfiguration.editDialog.defaultLanguageLabel')}</Label>
              <Input
                id="ai-language"
                placeholder={t('brandProfile.assets.aiConfiguration.editDialog.defaultLanguagePlaceholder')}
                value={aiConfigForm.defaultLanguage}
                onChange={(e) => setAiConfigForm(prev => ({ ...prev, defaultLanguage: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.assets.aiConfiguration.editDialog.contentLengthLabel')}</Label>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-length-min" className="text-xs">{t('brandProfile.assets.aiConfiguration.editDialog.minLabel')}</Label>
                  <Input
                    id="ai-length-min"
                    type="number"
                    placeholder="50"
                    value={aiConfigForm.contentLengthMin}
                    onChange={(e) => setAiConfigForm(prev => ({ ...prev, contentLengthMin: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-length-max" className="text-xs">{t('brandProfile.assets.aiConfiguration.editDialog.maxLabel')}</Label>
                  <Input
                    id="ai-length-max"
                    type="number"
                    placeholder="280"
                    value={aiConfigForm.contentLengthMax}
                    onChange={(e) => setAiConfigForm(prev => ({ ...prev, contentLengthMax: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('brandProfile.assets.aiConfiguration.editDialog.unitLabel')}</Label>
                <Select
                  value={aiConfigForm.contentLengthUnit}
                  onValueChange={(value: 'chars' | 'words') => setAiConfigForm(prev => ({ ...prev, contentLengthUnit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chars">{t('brandProfile.assets.aiConfiguration.editDialog.charactersOption')}</SelectItem>
                    <SelectItem value="words">{t('brandProfile.assets.aiConfiguration.editDialog.wordsOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-cta">{t('brandProfile.assets.aiConfiguration.editDialog.ctaStyleLabel')}</Label>
              <Input
                id="ai-cta"
                placeholder={t('brandProfile.assets.aiConfiguration.editDialog.ctaStylePlaceholder')}
                value={aiConfigForm.ctaStyle}
                onChange={(e) => setAiConfigForm(prev => ({ ...prev, ctaStyle: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brandProfile.assets.aiConfiguration.editDialog.preferredPlatformsLabel')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {aiConfigForm.preferredPlatforms.map((platform, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1 pr-1">
                    {platform}
                    <button
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={() => handleRemovePlatform(idx)}
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('brandProfile.assets.aiConfiguration.editDialog.preferredPlatformsPlaceholder')}
                  value={aiConfigForm.newPlatform}
                  onChange={(e) => setAiConfigForm(prev => ({ ...prev, newPlatform: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPlatform())}
                />
                <Button variant="outline" size="icon" onClick={handleAddPlatform}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiConfigDialog(false)} disabled={isProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAiConfig} disabled={isProfileSaving}>
              {isProfileSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Brand Logo</DialogTitle>
            <DialogDescription>
              Adjust the image to fit perfectly as your brand logo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cropper */}
            <div className="relative h-96 w-full bg-muted rounded-lg overflow-hidden">
              {selectedImage && (
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Zoom</label>
                  <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value)}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Rotation</label>
                  <span className="text-sm text-muted-foreground">{rotation}°</span>
                </div>
                <Slider
                  value={[rotation]}
                  onValueChange={([value]) => setRotation(value)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCropDialog(false)
                  setSelectedImage(null)
                  setCrop({ x: 0, y: 0 })
                  setZoom(1)
                  setRotation(0)
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button onClick={handleCropSave} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Save Logo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

