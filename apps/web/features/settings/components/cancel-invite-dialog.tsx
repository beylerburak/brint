"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { motion } from "motion/react";

interface CancelInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  email: string;
}

export function CancelInviteDialog({
  open,
  onOpenChange,
  onConfirm,
  email,
}: CancelInviteDialogProps) {
  const t = useTranslations("common");
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-start space-x-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
            >
              <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </motion.div>
            <DialogHeader>
              <DialogTitle>{t("settings.workspace.people.cancelInviteDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("settings.workspace.people.cancelInviteDialog.description", { email })}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading}
            >
              {t("settings.workspace.people.cancelInvite")}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

