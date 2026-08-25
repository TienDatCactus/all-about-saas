"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/context/auth"
import { DataAvatar } from "../data/avatar"
import { Link } from "@tanstack/react-router"
import { Route as LoginRoute } from "@/routes/auth/login"
import { ButtonGroup } from "@/components/ui/button-group"
import { Route as SignUpRoute } from "@/routes/auth/sign-up"
import {
  BellIcon,
  CheckCircleIcon,
  CreditCardIcon,
  SignOutIcon,
} from "@phosphor-icons/react"

export function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) {
    return (
      <ButtonGroup>
        <Button variant={"outline"}>
          <Link to={LoginRoute.path}>Login</Link>
        </Button>
        <Button>
          <Link to={SignUpRoute.path}>Sign up</Link>
        </Button>
      </ButtonGroup>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <DataAvatar item={user ?? undefined} getName={(u) => u.email} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <CheckCircleIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <BellIcon />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <SignOutIcon />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
