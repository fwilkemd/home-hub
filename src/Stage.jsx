/*
  The screen. A single 16:10 surface that scales as ONE unit to whatever space
  it's given (so it's identical on the Fire HD 10 and in a desktop frame).

  It is the container-query context: everything inside sizes in cq units, so
  type and composition hold their proportions at any scale. The album palette
  (--a1/--a2/--a3) is set here and CSS transitions it, which is what makes the
  whole room recolor smoothly when the track changes.
*/
export default function Stage({ paletteStyle, children, ...rest }) {
  return (
    <div className="stage-void">
      <div className="stage" style={paletteStyle} {...rest}>
        {children}
      </div>
    </div>
  )
}
