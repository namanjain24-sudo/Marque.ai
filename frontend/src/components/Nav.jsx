import { Link } from "react-router-dom"

import { Button } from "./Button"
import { Container } from "./Container"
import { Logo } from "./Logo"

export function Nav({ landing = false }) {
  const bar = landing
    ? "border-(--color-line) bg-(--color-paper)/90 dark:border-(--color-line-dark) dark:bg-(--color-paper-dark)/90"
    : "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90"
  const link = landing
    ? "text-(--color-ink-dim) hover:text-(--color-ink) dark:text-(--color-ink-inverse-dim) dark:hover:text-(--color-ink-inverse)"
    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur ${bar}`}>
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" aria-label="Marque.ai home">
          {landing ? (
            <Logo markClassName="text-(--color-gold-strong)" textClassName="text-(--color-ink) dark:text-(--color-ink-inverse)" />
          ) : (
            <Logo />
          )}
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/brands" className={`hidden text-[15px] font-medium transition-colors sm:inline ${link}`}>
            Live brands
          </Link>
          <Link to="/workspace" className={`hidden text-[15px] font-medium transition-colors sm:inline ${link}`}>
            Workspace
          </Link>
          <Link to="/library" className={`hidden text-[15px] font-medium transition-colors sm:inline ${link}`}>
            Library
          </Link>
          {landing ? (
            <Link
              to="/onboard"
              className="inline-flex items-center justify-center rounded-xl bg-(--color-gold) px-4 py-2 text-sm font-semibold text-(--color-ink) transition-colors hover:bg-(--color-gold-strong) active:scale-[0.98]"
            >
              Get started
            </Link>
          ) : (
            <Button to="/onboard" className="px-4 py-2 text-sm">
              Get started
            </Button>
          )}
        </nav>
      </Container>
    </header>
  )
}
