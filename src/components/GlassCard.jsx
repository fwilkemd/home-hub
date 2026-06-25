/*
  The single glass-surface recipe, reused by every card: low-alpha white, soft
  blur, hairline border with a subtle top inner-highlight, large soft shadow.
*/
export default function GlassCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        borderRadius: 28,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow:
          '0 24px 60px rgba(0,0,0,0.38), inset 0 1px 0 var(--glass-highlight)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
