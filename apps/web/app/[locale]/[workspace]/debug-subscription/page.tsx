"use client";

import { useSubscription, useSubscriptionLimits, useUsage } from "@/features/subscription";
import { useBrand } from "@/features/brand/context/brand-context";

export default function DebugSubscriptionPage() {
  const { subscription, plan, loading: subscriptionLoading } = useSubscription();
  const { getLimit, isUnlimited } = useSubscriptionLimits();
  const { brand } = useBrand();

  // Fetch real usage from backend
  const workspaceUsage = useUsage("workspace.maxCount");
  const brandUsage = useUsage("brand.maxCount");
  const socialAccountUsage = useUsage("brand.socialAccount.maxCount", brand?.id);
  const contentUsage = useUsage("brand.content.maxCountPerMonth", brand?.id);

  const loading = subscriptionLoading || workspaceUsage.loading || brandUsage.loading;

  if (loading) {
    return <div className="p-8">Loading subscription...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Subscription Debug</h1>
        <p className="text-muted-foreground">
          Test subscription limits and plan-based restrictions
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Current Subscription</h2>
        <div>
          <span className="font-medium">Plan: </span>
          <span className={`px-2 py-1 rounded text-sm ${
            plan === "FREE" ? "bg-gray-200" : plan === "PRO" ? "bg-blue-200" : "bg-purple-200"
          }`}>
            {plan}
          </span>
        </div>
        {subscription && (
          <>
            <div>
              <span className="font-medium">Status: </span>
              <span className={`px-2 py-1 rounded text-sm ${
                subscription.status === "ACTIVE" ? "bg-green-200" : "bg-gray-200"
              }`}>
                {subscription.status}
              </span>
            </div>
            {subscription.periodEnd && (
              <div>
                <span className="font-medium">Period End: </span>
                <span>{new Date(subscription.periodEnd).toLocaleDateString()}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Plan Limits</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Workspaces: </span>
            <span>{isUnlimited("workspace.maxCount") ? "Unlimited" : getLimit("workspace.maxCount")}</span>
          </div>
          <div>
            <span className="font-medium">Brands: </span>
            <span>{isUnlimited("brand.maxCount") ? "Unlimited" : getLimit("brand.maxCount")}</span>
          </div>
          <div>
            <span className="font-medium">Social Accounts: </span>
            <span>
              {isUnlimited("brand.socialAccount.maxCount")
                ? "Unlimited"
                : getLimit("brand.socialAccount.maxCount")}
            </span>
          </div>
          <div>
            <span className="font-medium">Content/Month: </span>
            <span>
              {isUnlimited("brand.content.maxCountPerMonth")
                ? "Unlimited"
                : getLimit("brand.content.maxCountPerMonth")}
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Real Usage (from Backend)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Workspaces: </span>
            {workspaceUsage.loading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : workspaceUsage.error ? (
              <span className="text-sm text-red-500">Error: {workspaceUsage.error.message}</span>
            ) : workspaceUsage.data ? (
              <>
                <span className={`px-2 py-1 rounded text-sm ${
                  workspaceUsage.data.remaining !== null && workspaceUsage.data.remaining > 0 ? "bg-green-200" : "bg-red-200"
                }`}>
                  {workspaceUsage.data.current} / {workspaceUsage.data.isUnlimited ? "∞" : workspaceUsage.data.limit}
                </span>
                <div className="text-sm text-gray-600 mt-1">
                  Remaining: {workspaceUsage.data.isUnlimited ? "Unlimited" : workspaceUsage.data.remaining}
                </div>
              </>
            ) : null}
          </div>
          <div>
            <span className="font-medium">Brands: </span>
            {brandUsage.loading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : brandUsage.error ? (
              <span className="text-sm text-red-500">Error: {brandUsage.error.message}</span>
            ) : brandUsage.data ? (
              <>
                <span className={`px-2 py-1 rounded text-sm ${
                  brandUsage.data.remaining !== null && brandUsage.data.remaining > 0 ? "bg-green-200" : "bg-red-200"
                }`}>
                  {brandUsage.data.current} / {brandUsage.data.isUnlimited ? "∞" : brandUsage.data.limit}
                </span>
                <div className="text-sm text-gray-600 mt-1">
                  Remaining: {brandUsage.data.isUnlimited ? "Unlimited" : brandUsage.data.remaining}
                </div>
              </>
            ) : null}
          </div>
          <div>
            <span className="font-medium">Social Accounts: </span>
            {!brand?.id ? (
              <span className="text-sm text-gray-500">Select a brand first</span>
            ) : socialAccountUsage.loading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : socialAccountUsage.error ? (
              <span className="text-sm text-red-500">Error: {socialAccountUsage.error.message}</span>
            ) : socialAccountUsage.data ? (
              <>
                <span className={`px-2 py-1 rounded text-sm ${
                  socialAccountUsage.data.remaining !== null && socialAccountUsage.data.remaining > 0 ? "bg-green-200" : "bg-red-200"
                }`}>
                  {socialAccountUsage.data.current} / {socialAccountUsage.data.isUnlimited ? "∞" : socialAccountUsage.data.limit}
                </span>
                <div className="text-sm text-gray-600 mt-1">
                  Remaining: {socialAccountUsage.data.isUnlimited ? "Unlimited" : socialAccountUsage.data.remaining}
                </div>
              </>
            ) : null}
          </div>
          <div>
            <span className="font-medium">Content (This Month): </span>
            {!brand?.id ? (
              <span className="text-sm text-gray-500">Select a brand first</span>
            ) : contentUsage.loading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : contentUsage.error ? (
              <span className="text-sm text-red-500">Error: {contentUsage.error.message}</span>
            ) : contentUsage.data ? (
              <>
                <span className={`px-2 py-1 rounded text-sm ${
                  contentUsage.data.remaining !== null && contentUsage.data.remaining > 0 ? "bg-green-200" : "bg-red-200"
                }`}>
                  {contentUsage.data.current} / {contentUsage.data.isUnlimited ? "∞" : contentUsage.data.limit}
                </span>
                <div className="text-sm text-gray-600 mt-1">
                  Remaining: {contentUsage.data.isUnlimited ? "Unlimited" : contentUsage.data.remaining}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

