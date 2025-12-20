"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  Database,
  Zap,
  BookOpen,
  Settings,
  LogOut,
  Cloud,
  Shield,
  Mail,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    label: "Personality",
    href: "/personality",
    icon: Brain,
  },
  {
    label: "Memory",
    href: "/memory",
    icon: Database,
  },
  {
    label: "Learning",
    href: "/learning",
    icon: Zap,
  },
  {
    label: "Knowledge Base",
    href: "/knowledge",
    icon: BookOpen,
  },
  {
    label: "Source Code",
    href: "/source",
    icon: Code,
  },
  {
    label: "Inference Rules",
    href: "/inference",
    icon: Settings,
  },
];

const integrationItems = [
// ... (rest of the file)
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-card p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">F</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold">FazAI</h1>
          <p className="text-xs text-muted-foreground">ECOA Interface</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 mb-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
        </p>
      </div>

      <nav className="flex flex-col gap-2">
        {integrationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6">
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
