'use client';

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

interface IntegrationItem {
  id: string;
  integrationType: 'GOOGLE_DRIVE' | string;
  status: 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISCONNECTED';
  statusMessage?: string | null;
  hasAuth: boolean;
}

export default function WorkspaceIntegrationsPage() {
  const { currentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Check for OAuth callback results
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'google-drive') {
      toast.success('Google Drive connected successfully');
      void loadIntegrations();
    } else if (error === 'google-drive') {
      toast.error('Failed to connect Google Drive');
    }
  }, [searchParams]);

  const loadIntegrations = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const res = await apiClient.listIntegrations(currentWorkspace.id);
      setIntegrations(res.integrations);
    } catch (error: any) {
      console.error('Failed to load integrations:', error);
      toast.error('Failed to load integrations', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace) {
      void loadIntegrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  const googleDrive = integrations.find((i) => i.integrationType === 'GOOGLE_DRIVE');

  const handleConnectGoogleDrive = async () => {
    if (!currentWorkspace) return;
    
    try {
      const res = await apiClient.getGoogleDriveAuthUrl(currentWorkspace.id);
      window.location.href = res.url;
    } catch (error: any) {
      console.error('Failed to get auth URL:', error);
      toast.error('Failed to connect Google Drive', {
        description: error.message || 'An error occurred',
      });
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    if (!currentWorkspace) return;
    
    try {
      await apiClient.disconnectGoogleDrive(currentWorkspace.id);
      toast.success('Google Drive disconnected');
      await loadIntegrations();
    } catch (error: any) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect Google Drive', {
        description: error.message || 'An error occurred',
      });
    }
  };

  const handleTestFiles = async () => {
    if (!currentWorkspace) return;
    
    try {
      const res = await apiClient.listGoogleDriveFiles(currentWorkspace.id);
      console.log('Google Drive files:', res.files);
      toast.success(`Found ${res.files.length} files`, {
        description: 'Check console for details',
      });
    } catch (error: any) {
      console.error('Failed to list files:', error);
      toast.error('Failed to list files', {
        description: error.message || 'An error occurred',
      });
    }
  };

  if (loading) {
    return (
      <div className="container py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading integrations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect third-party tools to your workspace.
        </p>
      </div>

      <div className="border rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium">Google Drive</div>
          <div className="text-sm text-muted-foreground">
            {googleDrive?.status === 'ACTIVE'
              ? 'Connected'
              : 'Not connected'}
            {googleDrive?.statusMessage
              ? ` • ${googleDrive.statusMessage}`
              : null}
          </div>
        </div>

        <div className="flex gap-2">
          {googleDrive?.status === 'ACTIVE' ? (
            <>
              <Button variant="outline" size="sm" onClick={handleTestFiles}>
                Test: List Files
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnectGoogleDrive}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleConnectGoogleDrive}>
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
