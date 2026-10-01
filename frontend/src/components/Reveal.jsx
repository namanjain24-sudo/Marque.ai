import { motion, useReducedMotion } from "motion/react"

// Storytelling: sections arrive in sequence as the owner scrolls, instead of
// the whole page popping in at once. See design-taste-frontend skill 5.C.
export function Reveal({ as: Tag = motion.div, delay = 0, className = "", children }) {
  const reduce = useReducedMotion()
  return (
    <Tag
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </Tag>
  )
}
