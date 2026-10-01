// components/landing/LandingButton.jsx — gold/paper CTA, used only by Home.jsx.
// A separate file from the shared components/Button.jsx on purpose: Button
// is also used by Audit/Brand (outside the landing page) and must keep its
// original emerald styling untouched.
import { Link } from "react-router-dom"

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[15px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-gold-strong) disabled:pointer-events-none disabled:opacity-50"

const variants = {
  primary: "bg-(--color-gold) text-(--color-ink) hover:bg-(--color-gold-strong)",
  secondary:
    "border border-(--color-line) text-(--color-ink) hover:border-(--color-ink-faint) hover:bg-(--color-paper-soft) dark:border-(--color-line-dark) dark:text-(--color-ink-inverse) dark:hover:border-(--color-ink-inverse-dim) dark:hover:bg-(--color-card-dark)",
}

export function LandingButton({ variant = "primary", to, type = "button", className = "", children, ...props }) {
  const classes = `${base} ${variants[variant]} ${className}`
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
