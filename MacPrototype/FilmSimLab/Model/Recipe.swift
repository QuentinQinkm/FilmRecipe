import Foundation

struct Layer: Codable, Identifiable {
    let id: UUID
    var name: String
    var sensitizerPeak: Float
    var sensitizerBw: Float
    var dyeHue: Float
    var dyePurity: Float
    var dmax: Float
    var hdToe: Float
    var hdGamma: Float
    var hdShoulder: Float
    var crystalSize: Float

    init(
        name: String,
        sensitizerPeak: Float,
        sensitizerBw: Float,
        dyeHue: Float,
        dyePurity: Float,
        dmax: Float,
        hdToe: Float,
        hdGamma: Float,
        hdShoulder: Float,
        crystalSize: Float
    ) {
        self.id = UUID()
        self.name = name
        self.sensitizerPeak = sensitizerPeak
        self.sensitizerBw = sensitizerBw
        self.dyeHue = dyeHue
        self.dyePurity = dyePurity
        self.dmax = dmax
        self.hdToe = hdToe
        self.hdGamma = hdGamma
        self.hdShoulder = hdShoulder
        self.crystalSize = crystalSize
    }
}

struct GlobalParams: Codable {
    var reversal: Float
    var stackingStrength: Float
    var maskDensity: Float
    var maskHue: Float
    var dirInhibition: Float
    var baseTintR: Float
    var baseTintG: Float
    var baseTintB: Float
}

struct Recipe: Codable, Identifiable {
    let id: UUID
    var name: String
    var layers: [Layer]
    var global: GlobalParams

    init(name: String, layers: [Layer], global: GlobalParams) {
        self.id = UUID()
        self.name = name
        self.layers = layers
        self.global = global
    }
}

/// Compute complementary dye hue from sensitizer wavelength.
/// Red-sensitive (620nm) -> cyan dye, green (540nm) -> magenta, blue (440nm) -> yellow.
func complementHue(wavelength wl: Float) -> Float {
    let stops: [(Float, Float)] = [
        (380, 270), (440, 235), (490, 180), (540, 120),
        (580, 40), (620, 15), (700, 0),
    ]
    var h: Float
    if wl <= stops[0].0 {
        h = stops[0].1
    } else if wl >= stops[stops.count - 1].0 {
        h = stops[stops.count - 1].1
    } else {
        h = stops[0].1
        for i in 0..<(stops.count - 1) {
            if wl >= stops[i].0 && wl <= stops[i + 1].0 {
                let t = (wl - stops[i].0) / (stops[i + 1].0 - stops[i].0)
                h = stops[i].1 + (stops[i + 1].1 - stops[i].1) * t
                break
            }
        }
    }
    return Float(Int(h.rounded()) + 180).truncatingRemainder(dividingBy: 360)
}
