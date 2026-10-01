import { GithubLogo } from "@phosphor-icons/react"

import { Container } from "./Container"
import { Logo } from "./Logo"

export function Footer({ landing = false }) {
  const bg = landing ? "bg-(--color-paper) dark:bg-(--color-paper-dark)" : ""
  const border = landing
    ? "border-(--color-line) dark:border-(--color-line-dark)"
    : "border-zinc-200 dark:border-zinc-800"
  const muted = landing
    ? "text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)"
    : "text-zinc-500 dark:text-zinc-500"
  const hover = landing
    ? "hover:text-(--color-ink) dark:hover:text-(--color-ink-inverse)"
    : "hover:text-zinc-900 dark:hover:text-zinc-100"

  return (
    <footer className={`border-t py-10 ${border} ${bg}`}>
      <Container className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          {landing ? (
            <Logo markClassName="text-(--color-gold-strong)" textClassName="text-(--color-ink) dark:text-(--color-ink-inverse)" />
          ) : (
            <Logo />
          )}
          <p className={`text-sm ${muted}`}>A brand identity system that remembers the rules.</p>
        </div>
        <a
          href="https://github.com/namanjain24-sudo/Marque.ai"
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${muted} ${hover}`}
        >
          <GithubLogo size={18} weight="regular" />
          Source
        </a>
      </Container>
    </footer>
  )
}
