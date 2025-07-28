"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  MessageSquareText,
  Settings,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MainSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="h-full border-r">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/">
          <h1 className="text-lg font-semibold">斯坦福小镇</h1>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">切换侧边栏</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>斯坦福小镇</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <SidebarNav pathname={pathname || '/'} setOpen={setOpen} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="hidden md:block">
        <div className="flex h-[calc(100vh-64px)] flex-col">
          <div className="flex-1 overflow-auto py-2">
            <SidebarNav pathname={pathname || '/'} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarNavProps {
  pathname: string;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

function SidebarNav({ pathname, setOpen }: SidebarNavProps) {
  const handleClick = () => {
    if (setOpen) {
      setOpen(false);
    }
  };

  return (
    <div className="px-3 py-2">
      <h2 className="px-4 text-lg font-semibold tracking-tight">导航</h2>
      <div className="space-y-1 py-2">
        <NavItem
          href="/"
          icon={<Home className="mr-2 h-4 w-4" />}
          label="首页"
          isActive={pathname === "/"}
          onClick={handleClick}
        />
        <NavItem
          href="/agents"
          icon={<Users className="mr-2 h-4 w-4" />}
          label="居民"
          isActive={pathname === "/agents"}
          onClick={handleClick}
        />
        <NavItem
          href="/conversations"
          icon={<MessageSquareText className="mr-2 h-4 w-4" />}
          label="对话"
          isActive={pathname === "/conversations"}
          onClick={handleClick}
        />
        <NavItem
          href="/settings"
          icon={<Settings className="mr-2 h-4 w-4" />}
          label="设置"
          isActive={pathname === "/settings"}
          onClick={handleClick}
        />
      </div>
    </div>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-md px-3 py-2 text-sm font-medium",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </Link>
  );
}
