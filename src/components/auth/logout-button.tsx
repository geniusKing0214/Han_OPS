"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  showIcon?: boolean;
  fullWidth?: boolean;
};

export function LogoutButton({
  className,
  variant = "outline",
  size = "sm",
  showIcon = true,
  fullWidth = false,
}: LogoutButtonProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(fullWidth && "w-full justify-start gap-2", className)}
      disabled={pending}
      onClick={() => void handleLogout()}
    >
      {showIcon ? <LogOut className="size-4" /> : null}
      {pending ? "로그아웃 중..." : "로그아웃"}
    </Button>
  );
}
