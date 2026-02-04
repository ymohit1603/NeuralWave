'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/hooks/useSavedTracks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Brain, User, Crown, Trash2, LogOut, Music, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const router = useRouter();
  const { preferences, updatePreferences, resetPreferences } = useUserPreferences();
  const { user, hasActiveSubscription, subscriptionPlan, signOut, freeConversionsUsed } = useAuth();
  const { tracks, clearAllTracks } = useSavedTracks();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error signing out",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleClearTracks = () => {
    clearAllTracks();
    setShowDeleteDialog(false);
    toast({
      title: "Tracks deleted",
      description: "All saved tracks have been removed",
    });
  };

  const handleResetPreferences = () => {
    resetPreferences();
    setShowResetDialog(false);
    toast({
      title: "Preferences reset",
      description: "All settings have been restored to defaults",
    });
  };

  const getPlanDisplayName = () => {
    switch (subscriptionPlan) {
      case 'weekly': return 'Weekly Pro';
      case 'yearly': return 'Yearly Pro';
      case 'lifetime': return 'Lifetime Pro';
      default: return 'Free';
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Mobile Menu Bar */}
        <div className="lg:hidden sticky top-0 z-20 glass-card border-b border-primary/10 h-14" />

        {/* Header */}
        <header className="glass-card border-b border-primary/10 lg:sticky lg:top-0 lg:z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
          {/* Account Section */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Account</h2>
            </div>

            <div className="p-5 rounded-2xl glass-card border border-primary/20">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-semibold text-white">
                        {user.email?.[0].toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                      className="w-full gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">Sign in to sync your data across devices</p>
                  <Button variant="neural" onClick={() => router.push('/dashboard')}>
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Subscription Section */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Subscription</h2>
            </div>

            <div className="p-5 rounded-2xl glass-card border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">Current Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveSubscription ? 'Full access to all features' : 'Limited to 30-second previews'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  hasActiveSubscription
                    ? 'bg-accent/20 text-accent'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {getPlanDisplayName()}
                </span>
              </div>

              {!hasActiveSubscription && (
                <>
                  <div className="p-3 rounded-lg bg-muted/50 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Free conversions used: <span className="font-medium text-foreground">{freeConversionsUsed}/1</span>
                    </p>
                  </div>
                  <Button
                    variant="neural"
                    className="w-full"
                    onClick={() => router.push('/dashboard/upgrade')}
                  >
                    Upgrade to Pro
                  </Button>
                </>
              )}

              {hasActiveSubscription && subscriptionPlan !== 'lifetime' && (
                <p className="text-xs text-muted-foreground">
                  Your subscription will automatically renew. Manage billing in your payment provider dashboard.
                </p>
              )}
            </div>
          </section>

          {/* Neural Profile Section */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Neural Profile</h2>
            </div>

            <div className="p-5 rounded-2xl glass-card border border-primary/20">
              {preferences.hasCompletedQuiz ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Primary Goal</p>
                      <p className="text-sm text-muted-foreground capitalize">{preferences.goal || 'Focus'}</p>
                    </div>
                    <select
                      value={preferences.goal || 'focus'}
                      onChange={(e) => updatePreferences({ goal: e.target.value })}
                      className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm"
                    >
                      <option value="focus">Focus</option>
                      <option value="relaxation">Relaxation</option>
                      <option value="energy">Energy</option>
                      <option value="study">Study</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div>
                      <p className="font-medium">ADHD Mode</p>
                      <p className="text-sm text-muted-foreground">Enhanced frequencies for focus</p>
                    </div>
                    <Switch
                      checked={preferences.hasADHD === "yes"}
                      onCheckedChange={(checked) =>
                        updatePreferences({ hasADHD: checked ? "yes" : "no" })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div>
                      <p className="font-medium">Effect Intensity</p>
                      <p className="text-sm text-muted-foreground capitalize">{preferences.intensity || 'Moderate'}</p>
                    </div>
                    <select
                      value={preferences.intensity || 'moderate'}
                      onChange={(e) => updatePreferences({ intensity: e.target.value })}
                      className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm"
                    >
                      <option value="subtle">Subtle</option>
                      <option value="moderate">Moderate</option>
                      <option value="intense">Intense</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Complete the quiz to personalize your experience</p>
                  <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    Take Quiz
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Data Management Section */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Data</h2>
            </div>

            <div className="p-5 rounded-2xl glass-card border border-primary/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Saved Tracks</p>
                  <p className="text-sm text-muted-foreground">{tracks.length} tracks stored locally</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={tracks.length === 0}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <p className="font-medium">Total Conversions</p>
                  <p className="text-sm text-muted-foreground">Tracks processed all time</p>
                </div>
                <span className="text-lg font-semibold">{preferences.conversions || 0}</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <p className="font-medium">Reset All Settings</p>
                  <p className="text-sm text-muted-foreground">Clear preferences and start fresh</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                  className="gap-2"
                >
                  Reset
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Delete Tracks Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete All Tracks?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {tracks.length} saved tracks from your device.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearTracks}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Settings Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset your neural profile, preferences, and conversion count.
              Your saved tracks will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPreferences}>
              Reset Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
