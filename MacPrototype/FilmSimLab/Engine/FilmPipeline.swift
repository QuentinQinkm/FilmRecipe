import CoreImage
import CoreGraphics

class FilmPipeline {
    private let filter = FilmCIFilter()
    let context = CIContext(options: [.useSoftwareRenderer: false])

    func process(image: CIImage, recipe: Recipe, rawMode: Bool = false) -> CIImage? {
        filter.inputImage = image
        filter.recipe = recipe
        filter.rawMode = rawMode
        return filter.outputImage
    }

    func renderToCGImage(image: CIImage, recipe: Recipe, rawMode: Bool = false) -> CGImage? {
        guard let output = process(image: image, recipe: recipe, rawMode: rawMode) else {
            return nil
        }
        return context.createCGImage(output, from: output.extent)
    }
}
