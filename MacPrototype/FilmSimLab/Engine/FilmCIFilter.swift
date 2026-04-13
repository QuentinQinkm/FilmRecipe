import CoreImage

class FilmCIFilter: CIFilter {
    var inputImage: CIImage?
    var recipe: Recipe?
    var rawMode: Bool = false

    private static var kernel: CIKernel? = {
        guard let url = Bundle.main.url(forResource: "default", withExtension: "metallib"),
              let data = try? Data(contentsOf: url) else {
            print("Failed to load Metal library")
            return nil
        }
        return try? CIKernel(functionName: "filmSimulation", fromMetalLibraryData: data)
    }()

    override var outputImage: CIImage? {
        guard let input = inputImage, let recipe = recipe, let kernel = Self.kernel else {
            return inputImage
        }

        let layers = recipe.layers
        let n = min(layers.count, 5)
        let g = recipe.global

        // Helper to safely get layer property or default
        func lp(_ idx: Int, _ prop: (Layer) -> Float, _ def: Float) -> Float {
            idx < n ? prop(layers[idx]) : def
        }

        // Pack layer data into float4 vectors for the kernel
        let peaks_bws = CIVector(x: CGFloat(lp(0, \.sensitizerPeak, 550)), y: CGFloat(lp(0, \.sensitizerBw, 100)),
                                 z: CGFloat(lp(1, \.sensitizerPeak, 550)), w: CGFloat(lp(1, \.sensitizerBw, 100)))
        let peaks_bws2 = CIVector(x: CGFloat(lp(2, \.sensitizerPeak, 550)), y: CGFloat(lp(2, \.sensitizerBw, 100)),
                                  z: CGFloat(lp(3, \.sensitizerPeak, 550)), w: CGFloat(lp(3, \.sensitizerBw, 100)))
        let peak_bw4 = CIVector(x: CGFloat(lp(4, \.sensitizerPeak, 550)), y: CGFloat(lp(4, \.sensitizerBw, 100)), z: 0, w: 0)

        let toes_gammas = CIVector(x: CGFloat(lp(0, \.hdToe, 0.2)), y: CGFloat(lp(0, \.hdGamma, 0.7)),
                                   z: CGFloat(lp(1, \.hdToe, 0.2)), w: CGFloat(lp(1, \.hdGamma, 0.7)))
        let toes_gammas2 = CIVector(x: CGFloat(lp(2, \.hdToe, 0.2)), y: CGFloat(lp(2, \.hdGamma, 0.7)),
                                    z: CGFloat(lp(3, \.hdToe, 0.2)), w: CGFloat(lp(3, \.hdGamma, 0.7)))
        let toe_gam4 = CIVector(x: CGFloat(lp(4, \.hdToe, 0.2)), y: CGFloat(lp(4, \.hdGamma, 0.7)), z: 0, w: 0)

        let shos_dmaxs = CIVector(x: CGFloat(lp(0, \.hdShoulder, 0.15)), y: CGFloat(lp(0, \.dmax, 2.0)),
                                  z: CGFloat(lp(1, \.hdShoulder, 0.15)), w: CGFloat(lp(1, \.dmax, 2.0)))
        let shos_dmaxs2 = CIVector(x: CGFloat(lp(2, \.hdShoulder, 0.15)), y: CGFloat(lp(2, \.dmax, 2.0)),
                                   z: CGFloat(lp(3, \.hdShoulder, 0.15)), w: CGFloat(lp(3, \.dmax, 2.0)))
        let sho_dmax4 = CIVector(x: CGFloat(lp(4, \.hdShoulder, 0.15)), y: CGFloat(lp(4, \.dmax, 2.0)), z: 0, w: 0)

        let hues_purs = CIVector(x: CGFloat(lp(0, \.dyeHue, 0)), y: CGFloat(lp(0, \.dyePurity, 0)),
                                 z: CGFloat(lp(1, \.dyeHue, 0)), w: CGFloat(lp(1, \.dyePurity, 0)))
        let hues_purs2 = CIVector(x: CGFloat(lp(2, \.dyeHue, 0)), y: CGFloat(lp(2, \.dyePurity, 0)),
                                  z: CGFloat(lp(3, \.dyeHue, 0)), w: CGFloat(lp(3, \.dyePurity, 0)))
        let hue_pur4 = CIVector(x: CGFloat(lp(4, \.dyeHue, 0)), y: CGFloat(lp(4, \.dyePurity, 0)), z: 0, w: 0)

        let crystalsVec = CIVector(x: CGFloat(lp(0, \.crystalSize, 0.3)), y: CGFloat(lp(1, \.crystalSize, 0.3)),
                                   z: CGFloat(lp(2, \.crystalSize, 0.3)), w: CGFloat(lp(3, \.crystalSize, 0.3)))
        let crystal4Vec = CIVector(x: CGFloat(lp(4, \.crystalSize, 0.3)), y: 0, z: 0, w: 0)

        let baseTintVec = CIVector(x: CGFloat(g.baseTintR), y: CGFloat(g.baseTintG), z: CGFloat(g.baseTintB))

        return kernel.apply(
            extent: input.extent,
            roiCallback: { _, rect in rect },
            arguments: [
                input,
                peaks_bws, peaks_bws2, peak_bw4,
                toes_gammas, toes_gammas2, toe_gam4,
                shos_dmaxs, shos_dmaxs2, sho_dmax4,
                hues_purs, hues_purs2, hue_pur4,
                crystalsVec, crystal4Vec,
                g.reversal,
                rawMode ? Float(1) : Float(0),
                Float(n),
                g.dirInhibition,
                g.maskDensity,
                g.maskHue,
                baseTintVec,
                g.stackingStrength,
            ]
        )
    }
}
