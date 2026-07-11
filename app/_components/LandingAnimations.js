'use client'
import { motion } from 'framer-motion'

export function FadeInUp({ children, delay = 0, className, once = false }) {
  const viewportProps = once
    ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' } }
    : { animate: { opacity: 1, y: 0 } }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      {...viewportProps}
    >
      {children}
    </motion.div>
  )
}
