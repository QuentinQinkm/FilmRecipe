import SwiftUI
import CoreImage

struct ImageCanvas: NSViewRepresentable {
    let sourceImage: CIImage?
    let recipe: Recipe
    var rawMode: Bool = false

    private let pipeline = FilmPipeline()

    func makeNSView(context: Context) -> NSImageView {
        let view = NSImageView()
        view.imageScaling = .scaleProportionallyUpOrDown
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.black.cgColor
        return view
    }

    func updateNSView(_ nsView: NSImageView, context: Context) {
        guard let source = sourceImage else {
            nsView.image = nil
            return
        }

        // Scale source to fit viewport before processing
        let viewSize = nsView.bounds.size
        guard viewSize.width > 0 && viewSize.height > 0 else { return }

        let scale = NSScreen.main?.backingScaleFactor ?? 2.0
        let targetW = viewSize.width * scale
        let targetH = viewSize.height * scale
        let imgW = source.extent.width
        let imgH = source.extent.height

        let fitScale = min(targetW / imgW, targetH / imgH, 1.0) // never upscale
        let scaled = fitScale < 1.0
            ? source.transformed(by: CGAffineTransform(scaleX: fitScale, y: fitScale))
            : source

        guard let cgImage = pipeline.renderToCGImage(image: scaled, recipe: recipe, rawMode: rawMode) else {
            nsView.image = nil
            return
        }
        nsView.image = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }
}
