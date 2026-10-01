import { GithubLogo } from "@phosphor-icons/react"

import { Container } from "./Container"
import { Logo } from "./Logo"

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
      <Container className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Logo />
          <p className="text-sm text-zinc-500 dark:text-zinc-500">A brand identity system that remembers the rules.</p>
        </div>
        <a
          href="https://github.com/namanjain24-sudo/Marque.ai"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <GithubLogo size={18} weight="regular" />
          Source
        </a>
      </Container>
    </footer>
  )
}
