// components/ui/container-scroll-animation.jsx
// Aceternity UI's ContainerScroll, adapted to this project's `motion/react`
// import (the renamed Framer Motion package, already used everywhere else
// here) instead of `framer-motion`, and to a plain Vite SPA (no "use client").
import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform } from "motion/react"

export function ContainerScroll({ titleComponent, children }) {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const scaleDimensions = isMobile ? [0.7, 0.9] : [1.05, 1]

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions)
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div className="relative flex h-[50rem] items-center justify-center p-2 md:h-[70rem] md:p-20" ref={containerRef}>
      <div className="relative w-full py-10 md:py-40" style={{ perspective: "1000px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  )
}

function Header({ translate, titleComponent }) {
  return (
    <motion.div style={{ translateY: translate }} className="mx-auto max-w-5xl text-center">
      {titleComponent}
    </motion.div>
  )
}

function Card({ rotate, scale, children }) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="mx-auto -mt-12 h-[28rem] w-full max-w-5xl rounded-[30px] border-4 border-(--color-ink) bg-(--color-ink) p-2 shadow-2xl md:h-[38rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-(--color-paper-dark)">{children}</div>
    </motion.div>
  )
}
