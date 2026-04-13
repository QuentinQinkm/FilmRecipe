import Foundation

enum StockTemplates {
    static let all: [Recipe] = [portra400, gold200, velvia50, kodachrome64, ilfordHP5, kodakTriX]

    static let portra400 = Recipe(
        name: "Portra 400",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 620, sensitizerBw: 80, dyeHue: 185, dyePurity: 0.70, dmax: 2.1, hdToe: 0.22, hdGamma: 0.68, hdShoulder: 0.18, crystalSize: 0.35),
            Layer(name: "magenta", sensitizerPeak: 540, sensitizerBw: 90, dyeHue: 320, dyePurity: 0.75, dmax: 2.0, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30),
            Layer(name: "yellow", sensitizerPeak: 440, sensitizerBw: 70, dyeHue: 55, dyePurity: 0.80, dmax: 2.2, hdToe: 0.18, hdGamma: 0.72, hdShoulder: 0.12, crystalSize: 0.28),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0.42, maskHue: 28, dirInhibition: 0.35, baseTintR: 1.0, baseTintG: 0.97, baseTintB: 0.94)
    )

    static let gold200 = Recipe(
        name: "Gold 200",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 615, sensitizerBw: 95, dyeHue: 190, dyePurity: 0.65, dmax: 2.3, hdToe: 0.15, hdGamma: 0.80, hdShoulder: 0.15, crystalSize: 0.25),
            Layer(name: "magenta", sensitizerPeak: 545, sensitizerBw: 100, dyeHue: 330, dyePurity: 0.72, dmax: 2.1, hdToe: 0.14, hdGamma: 0.82, hdShoulder: 0.14, crystalSize: 0.22),
            Layer(name: "yellow", sensitizerPeak: 445, sensitizerBw: 75, dyeHue: 48, dyePurity: 0.85, dmax: 2.4, hdToe: 0.12, hdGamma: 0.85, hdShoulder: 0.12, crystalSize: 0.20),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0.50, maskHue: 32, dirInhibition: 0.25, baseTintR: 1.0, baseTintG: 0.95, baseTintB: 0.88)
    )

    static let velvia50 = Recipe(
        name: "Velvia 50",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 630, sensitizerBw: 65, dyeHue: 195, dyePurity: 0.92, dmax: 2.8, hdToe: 0.35, hdGamma: 1.60, hdShoulder: 0.20, crystalSize: 0.15),
            Layer(name: "magenta", sensitizerPeak: 535, sensitizerBw: 70, dyeHue: 310, dyePurity: 0.90, dmax: 2.7, hdToe: 0.38, hdGamma: 1.65, hdShoulder: 0.18, crystalSize: 0.14),
            Layer(name: "yellow", sensitizerPeak: 430, sensitizerBw: 65, dyeHue: 58, dyePurity: 0.88, dmax: 2.6, hdToe: 0.32, hdGamma: 1.55, hdShoulder: 0.22, crystalSize: 0.13),
        ],
        global: GlobalParams(reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.60, baseTintR: 0.99, baseTintG: 0.99, baseTintB: 1.0)
    )

    static let kodachrome64 = Recipe(
        name: "Kodachrome 64",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 625, sensitizerBw: 70, dyeHue: 200, dyePurity: 0.88, dmax: 2.5, hdToe: 0.28, hdGamma: 1.30, hdShoulder: 0.18, crystalSize: 0.18),
            Layer(name: "magenta", sensitizerPeak: 545, sensitizerBw: 75, dyeHue: 350, dyePurity: 0.85, dmax: 2.4, hdToe: 0.25, hdGamma: 1.35, hdShoulder: 0.15, crystalSize: 0.17),
            Layer(name: "yellow", sensitizerPeak: 440, sensitizerBw: 68, dyeHue: 50, dyePurity: 0.90, dmax: 2.6, hdToe: 0.22, hdGamma: 1.40, hdShoulder: 0.14, crystalSize: 0.16),
        ],
        global: GlobalParams(reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.50, baseTintR: 1.0, baseTintG: 0.98, baseTintB: 0.96)
    )

    static let ilfordHP5 = Recipe(
        name: "Ilford HP5",
        layers: [
            Layer(name: "panchromatic", sensitizerPeak: 550, sensitizerBw: 150, dyeHue: 0, dyePurity: 0, dmax: 1.20, hdToe: 0.20, hdGamma: 0.78, hdShoulder: 0.15, crystalSize: 0.55),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintR: 1.0, baseTintG: 1.0, baseTintB: 1.0)
    )

    static let kodakTriX = Recipe(
        name: "Kodak Tri-X",
        layers: [
            Layer(name: "panchromatic", sensitizerPeak: 560, sensitizerBw: 140, dyeHue: 0, dyePurity: 0, dmax: 1.55, hdToe: 0.30, hdGamma: 1.05, hdShoulder: 0.18, crystalSize: 0.90),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintR: 0.99, baseTintG: 0.99, baseTintB: 0.98)
    )
}
