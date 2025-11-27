"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { requestMagicLink } from "@/shared/api/auth";

const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof LoginSchema>) {
    setIsSubmitting(true);
    try {
      await requestMagicLink(values.email);
      setEmailSent(true);
      toast({
        title: "Magic link sent",
        description: "Check your email for the login link",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send magic link",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a magic link to {form.getValues("email")}
        </p>
        <p className="text-sm text-muted-foreground">
          Click the link in your email to log in.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setEmailSent(false);
            form.reset();
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send magic link"}
        </Button>
      </form>
    </Form>
  );
}

