'use client';

import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function NavLink({ to, children, className }: NavLinkProps) {
  return (
    <Link
      href={to}
      className={cn(
        "text-sm font-medium transition-colors hover:text-foreground",
        className
      )}
    >
      {children}
    </Link>
  );
}
