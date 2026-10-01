import { Link } from "react-router-dom"

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-[15px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-50"

const variants = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary:
    "border border-zinc-300 text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
  ghost: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
}

export function Button({ variant = "primary", to, type = "button", className = "", children, ...props }) {
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
