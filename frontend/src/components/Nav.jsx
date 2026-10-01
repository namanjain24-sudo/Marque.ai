import { Link } from "react-router-dom"

import { Button } from "./Button"
import { Container } from "./Container"
import { Logo } from "./Logo"

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" aria-label="Marque.ai home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/brands"
            className="hidden text-[15px] font-medium text-zinc-600 transition-colors hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Live brands
          </Link>
          <Button to="/onboard" className="px-4 py-2 text-sm">
            Get started
          </Button>
        </nav>
      </Container>
    </header>
  )
}
