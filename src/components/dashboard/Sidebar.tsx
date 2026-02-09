'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Music, Crown, Settings, ChevronLeft, ChevronRight, Headphones, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/dashboard/tracks", icon: Music, label: "My Music" },
  { to: "/dashboard/upgrade", icon: Crown, label: "Upgrade to Pro", labelPro: "Manage Plan" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasActiveSubscription, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Get user display info
  const userEmail = user?.email || '';
  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'U';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'User';

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-4 z-50 p-2.5 rounded-xl bg-white border border-border hover:bg-secondary transition-colors"
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative flex flex-col h-screen bg-white/80 backdrop-blur-xl border-r border-border transition-all duration-300 z-40 ${
          collapsed ? 'w-16' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
      {/* Logo */}
      <div className="flex items-center gap-2.5 p-4 border-b border-border">
        <div className="flex-shrink-0 p-2 rounded-xl bg-primary">
          <Headphones className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-base tracking-tight">NeuralWave</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.to;
          const label = item.to === '/dashboard/upgrade' && hasActiveSubscription && item.labelPro
            ? item.labelPro
            : item.label;

          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200 ${
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-sm">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle - Desktop only */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-border hover:bg-secondary"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </Button>

      {/* Pro upgrade/manage banner */}
      {!collapsed && (
        <div className="m-3 p-4 rounded-xl bg-secondary border border-border">
          {hasActiveSubscription ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium">Pro Member</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to lifetime access
              </p>
              <Link href="/dashboard/upgrade" className="block" onClick={() => setMobileOpen(false)}>
                <Button variant="default" size="sm" className="w-full">
                  View Plans
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium">Go Pro</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Unlock full audio & downloads
              </p>
              <Link href="/dashboard/upgrade" className="block" onClick={() => setMobileOpen(false)}>
                <Button variant="default" size="sm" className="w-full">
                  Upgrade Now
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      {/* User profile section */}
      {user && (
        <div className={`border-t border-border p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-foreground">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
    </>
  );
}
