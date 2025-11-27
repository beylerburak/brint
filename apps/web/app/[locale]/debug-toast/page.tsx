"use client"

import { toast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

export default function DebugToastPage() {
  return (
    <div className="p-4 space-y-4">
      <Button onClick={() => toast({ title: "Success", description: "İşlem başarılı" })}>
        Toast Göster
      </Button>
    </div>
  )
}

