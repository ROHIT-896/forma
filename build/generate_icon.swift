import Cocoa

let size = CGSize(width: 1024, height: 1024)
let image = NSImage(size: size)

image.lockFocus()

guard let ctx = NSGraphicsContext.current?.cgContext else {
    exit(1)
}

// Transparent background
ctx.clear(CGRect(origin: .zero, size: size))

// macOS squircle / rounded rectangle with standard padding
let squircleRect = CGRect(x: 102, y: 102, width: 820, height: 820)
let cornerRadius: CGFloat = 185
let path = CGPath(roundedRect: squircleRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

// Outer shadow
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -20), blur: 40, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.55))
ctx.addPath(path)
ctx.setFillColor(CGColor(red: 0.08, green: 0.09, blue: 0.12, alpha: 1.0))
ctx.fillPath()
ctx.restoreGState()

// Gradient inside squircle
ctx.saveGState()
ctx.addPath(path)
ctx.clip()

let colorSpace = CGColorSpaceCreateDeviceRGB()
let gradientColors = [
    CGColor(red: 0.12, green: 0.14, blue: 0.19, alpha: 1.0),
    CGColor(red: 0.06, green: 0.07, blue: 0.09, alpha: 1.0)
] as CFArray

if let gradient = CGGradient(colorsSpace: colorSpace, colors: gradientColors, locations: [0.0, 1.0]) {
    ctx.drawLinearGradient(gradient, start: CGPoint(x: 512, y: 922), end: CGPoint(x: 512, y: 102), options: [])
}

// Inner border
ctx.addPath(path)
ctx.setLineWidth(4.0)
ctx.setStrokeColor(CGColor(red: 0.22, green: 0.26, blue: 0.35, alpha: 0.8))
ctx.strokePath()

// FORMA Emblem: Sleek stylized energetic "F" made of precision geometric bars (emerald + cyan accent)
let emerald = CGColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0) // #10B981
let mint = CGColor(red: 0.20, green: 0.88, blue: 0.65, alpha: 1.0)

// Vertical spine of F
let vBarRect = CGRect(x: 340, y: 300, width: 88, height: 424)
let vBarPath = CGPath(roundedRect: vBarRect, cornerWidth: 24, cornerHeight: 24, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 18, color: CGColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 0.4))
ctx.addPath(vBarPath)
ctx.setFillColor(emerald)
ctx.fillPath()
ctx.restoreGState()

// Top horizontal bar of F
let topBarRect = CGRect(x: 340, y: 636, width: 340, height: 88)
let topBarPath = CGPath(roundedRect: topBarRect, cornerWidth: 24, cornerHeight: 24, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 18, color: CGColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 0.4))
ctx.addPath(topBarPath)
ctx.setFillColor(mint)
ctx.fillPath()
ctx.restoreGState()

// Middle horizontal bar of F
let midBarRect = CGRect(x: 340, y: 476, width: 250, height: 80)
let midBarPath = CGPath(roundedRect: midBarRect, cornerWidth: 22, cornerHeight: 22, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 18, color: CGColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 0.4))
ctx.addPath(midBarPath)
ctx.setFillColor(emerald)
ctx.fillPath()
ctx.restoreGState()

// Subtle dynamic dot indicator (representing precision & metrics)
let dotRect = CGRect(x: 630, y: 330, width: 50, height: 50)
let dotPath = CGPath(ellipseIn: dotRect, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: 0), blur: 16, color: CGColor(red: 0.20, green: 0.88, blue: 0.65, alpha: 0.8))
ctx.addPath(dotPath)
ctx.setFillColor(mint)
ctx.fillPath()
ctx.restoreGState()

ctx.restoreGState() // unclip squircle

image.unlockFocus()

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    exit(1)
}

let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "build/icon.png"
try? pngData.write(to: URL(fileURLWithPath: outputPath))
print("Icon written successfully to \(outputPath)")
