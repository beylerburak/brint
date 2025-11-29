"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Animate UI Components
import { AvatarGroup } from "@/components/animate-ui/components/animate/avatar-group";
import { Progress } from "@/components/animate-ui/components/radix/progress";
import { Switch } from "@/components/animate-ui/components/radix/switch";
import { Checkbox } from "@/components/animate-ui/components/radix/checkbox";
import { FlipCard } from "@/components/animate-ui/components/community/flip-card";
import type { FlipCardData } from "@/components/animate-ui/components/community/flip-card";

export default function PlaygroundPage() {
  const [progress, setProgress] = React.useState(33);
  const [switchChecked, setSwitchChecked] = React.useState(false);
  const [checkboxChecked, setCheckboxChecked] = React.useState(false);

  const flipCardData: FlipCardData = {
    name: "John Doe",
    username: "johndoe",
    image: "https://github.com/shadcn.png",
    bio: "Full-stack developer passionate about creating beautiful user experiences.",
    stats: {
      following: 120,
      followers: 450,
      posts: 89,
    },
    socialLinks: {
      github: "https://github.com/johndoe",
      twitter: "https://twitter.com/johndoe",
      linkedin: "https://linkedin.com/in/johndoe",
    },
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Animate UI Playground</h1>
        <p className="text-muted-foreground mt-2">
          Test and explore all animated components from Animate UI
        </p>
      </div>

      <Tabs defaultValue="animate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="animate">Animate UI</TabsTrigger>
          <TabsTrigger value="radix">Radix UI</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        <TabsContent value="animate" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Avatar Group</CardTitle>
              <CardDescription>Animated avatar group with hover effects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <AvatarGroup>
                  <img
                    src="https://github.com/shadcn.png"
                    alt="Avatar 1"
                    className="size-12 rounded-full border-2 border-background"
                  />
                  <img
                    src="https://github.com/vercel.png"
                    alt="Avatar 2"
                    className="size-12 rounded-full border-2 border-background"
                  />
                  <img
                    src="https://github.com/nextjs.png"
                    alt="Avatar 3"
                    className="size-12 rounded-full border-2 border-background"
                  />
                </AvatarGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radix" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Animated progress bar component</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress(Math.max(0, progress - 10))}
                >
                  -10%
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress(Math.min(100, progress + 10))}
                >
                  +10%
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress(0)}
                >
                  Reset
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Current: {progress}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Switch</CardTitle>
              <CardDescription>Animated switch component with press animation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Switch
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <Label>Toggle switch</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                State: {switchChecked ? "Checked" : "Unchecked"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checkbox</CardTitle>
              <CardDescription>Animated checkbox component</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={checkboxChecked}
                  onCheckedChange={setCheckboxChecked}
                />
                <Label>Check me</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                State: {checkboxChecked ? "Checked" : "Unchecked"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="community" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Flip Card</CardTitle>
              <CardDescription>
                Animated flip card - hover or click to flip (desktop: hover, mobile: click)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FlipCard data={flipCardData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
