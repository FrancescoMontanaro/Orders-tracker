'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Home,
  Package,
  Users,
  ClipboardList,
  NotebookIcon,
  Receipt,
  BarChart3,
  Menu,
  Boxes,
  FileDown,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogoutButton } from '@/components/logout-button'
import { NotificationBell } from '@/components/notification-bell'
import { NotificationsProvider } from '@/contexts/notifications-context'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import Snowfall from 'react-snowfall';

// Company name from env (client-safe)
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Tracker Ordini'

// Routes config
const routes = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/products', label: 'Prodotti', Icon: Package },
  { href: '/customers', label: 'Clienti', Icon: Users },
  { href: '/orders', label: 'Ordini', Icon: ClipboardList },
  { href: '/lots', label: 'Lotti', Icon: Boxes },
  { href: '/balance', label: 'Bilancio', Icon: Receipt },
  { href: '/notes', label: 'Note', Icon: NotebookIcon },
  { href: '/reports', label: 'Report', Icon: BarChart3 },
  { href: '/export', label: 'Export', Icon: FileDown },
] as const

const desktopMenuGroups = [
  {
    label: 'Gestione',
    items: [
      {
        href: '/products',
        label: 'Prodotti',
        description: 'Catalogo, prezzi e stato dei prodotti.',
      },
      {
        href: '/customers',
        label: 'Clienti',
        description: 'Anagrafiche clienti e consultazione rapida.',
      },
      {
        href: '/orders',
        label: 'Ordini',
        description: 'Ordini, stati di avanzamento e dettagli.',
      },
      {
        href: '/lots',
        label: 'Lotti',
        description: 'Raccolte, locazioni e prodotti collegati.',
      },
    ],
  },
  {
    label: 'Analisi',
    items: [
      {
        href: '/balance',
        label: 'Bilancio',
        description: 'Entrate, uscite e categorie economiche.',
      },
      {
        href: '/reports',
        label: 'Report',
        description: 'Analisi per prodotti, clienti e categorie.',
      },
    ],
  },
  {
    label: 'Strumenti',
    items: [
      {
        href: '/notes',
        label: 'Note',
        description: 'Appunti operativi e archivio interno.',
      },
      {
        href: '/export',
        label: 'Export',
        description: 'Esporta dati in CSV o Excel.',
      },
    ],
  },
] as const

/** Brand (text only, no badge/initials) */
function Brand() {
  return (
    <Link
      href="/home"
      className="font-semibold tracking-tight truncate max-w-[50vw] md:max-w-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      title={COMPANY_NAME}
      aria-label={`${COMPANY_NAME} – home`}
    >
      {COMPANY_NAME}
    </Link>
  )
}


function isSnowPeriod(now: Date): boolean {
  const y = now.getFullYear()

  // Dec 8 of the current year
  const start = new Date(y, 11, 8, 0, 0, 0, 0)

  // Jan 7 of the next year
  const end = new Date(y + 1, 0, 7, 23, 59, 59, 999)

  // If we're in Jan (up to 7), the active window started Dec 8 of the previous year
  if (now.getMonth() === 0) {
    const startPrev = new Date(y - 1, 11, 8, 0, 0, 0, 0)
    const endThis = new Date(y, 0, 7, 23, 59, 59, 999)
    return now >= startPrev && now <= endThis
  }

  // Otherwise, for Feb..Dec, window is Dec 8 (this year) -> Jan 7 (next year)
  return now >= start && now <= end
}

/** Desktop nav */
function DesktopNav() {
  const pathname = usePathname()
  return (
    <NavigationMenu className="hidden md:block">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            active={pathname?.startsWith('/home')}
            className={`${navigationMenuTriggerStyle()} ${
              pathname?.startsWith('/home')
                ? 'relative bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent focus:text-foreground after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-primary'
                : 'hover:bg-accent/60'
            }`}
          >
            <Link href="/home" aria-current={pathname?.startsWith('/home') ? 'page' : undefined}>
              Home
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {desktopMenuGroups.map(({ label, items }) => {
          const groupActive = items.some(({ href }) => pathname?.startsWith(href))

          return (
            <NavigationMenuItem key={label}>
              <NavigationMenuTrigger
                className={
                  groupActive
                    ? 'relative bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent focus:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-primary'
                    : undefined
                }
              >
                {label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul
                  className={`grid gap-2 p-1 ${
                    items.length > 2 ? 'w-[420px] grid-cols-2' : 'w-[320px] grid-cols-1'
                  }`}
                >
                  {items.map(({ href, label: itemLabel, description }) => {
                    const active = pathname?.startsWith(href)

                    return (
                      <li key={href}>
                        <NavigationMenuLink
                          asChild
                          active={active}
                          className={active ? 'bg-accent/70' : undefined}
                        >
                          <Link href={href} aria-current={active ? 'page' : undefined}>
                            <span className="font-medium leading-none">{itemLabel}</span>
                            <span className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {description}
                            </span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    )
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

/** Mobile drawer nav — no overflow, links full-width, truncate labels */
function MobileDrawerNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 pl-2 pr-2">
      {routes.map(({ href, label, Icon }) => {
        const active = pathname?.startsWith(href)
        return (
          <SheetClose asChild key={href}>
            <Link
              href={href}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors overflow-hidden
                ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          </SheetClose>
        )
      })}
    </nav>
  )
}

/** AppShell */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [snowflakeCount, setSnowflakeCount] = useState(60)

  const showSnow = isSnowPeriod(new Date())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const updateSnowflakes = () => {
      setSnowflakeCount(mediaQuery.matches ? 60 : 25)
    }

    updateSnowflakes()

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateSnowflakes)
      return () => mediaQuery.removeEventListener('change', updateSnowflakes)
    }

    mediaQuery.addListener(updateSnowflakes)
    return () => mediaQuery.removeListener(updateSnowflakes)
  }, [])

  return (
    <NotificationsProvider>
    <div className="min-h-dvh grid grid-rows-[auto_1fr]">
      {showSnow ? (
        <Snowfall
          snowflakeCount={snowflakeCount}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 60,
          }}
        />
      ) : null}
      
      {/* Sticky header with blur, no x-overflow */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          {/* Left: mobile trigger + brand */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Apri menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="left"
                // prevent overflow horizontally; allow vertical scroll
                className="w-[86vw] max-w-[320px] overflow-y-auto overflow-x-hidden"
              >
                <SheetHeader className="mb-3 border-b pb-2">
                  <SheetTitle className="truncate">{COMPANY_NAME}</SheetTitle>
                </SheetHeader>

                <MobileDrawerNav />

                <div className="mt-4 border-t pt-3 flex items-center justify-between pl-2 pr-2">
                  <ThemeToggle />
                  <div className="flex items-center gap-2">
                    <SheetClose asChild>
                      <Button variant="outline" size="sm">
                        Chiudi
                      </Button>
                    </SheetClose>
                    <LogoutButton />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Brand />
          </div>

          {/* Center: desktop nav */}
          <DesktopNav />

          {/* Right: actions */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <NotificationBell />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content; no bottom tab bar, so normal padding; hide horizontal overflow */}
      <main className="container mx-auto w-full px-4 py-6 overflow-x-hidden">
        {children}
      </main>
    </div>
    </NotificationsProvider>
  )
}
