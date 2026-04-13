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
        guard let cgImage = pipeline.renderToCGImage(image: source, recipe: recipe, rawMode: rawMode) else {
            nsView.image = nil
            return
        }
        nsView.image = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }
}
