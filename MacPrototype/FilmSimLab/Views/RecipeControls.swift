import SwiftUI

struct LayerControls: View {
    @Binding var layer: Layer
    let index: Int

    var body: some View {
        Section("Layer \(index + 1): \(layer.name)") {
            SliderRow(label: "Sensitivity", value: $layer.sensitizerPeak, range: 380...700, format: "%.0f nm")
            SliderRow(label: "Bandwidth", value: $layer.sensitizerBw, range: 30...200, format: "%.0f nm")
            SliderRow(label: "Dye Purity", value: $layer.dyePurity, range: 0...1, format: "%.2f")
            SliderRow(label: "Dmax", value: $layer.dmax, range: 0.05...3.5, format: "%.2f")
            SliderRow(label: "Toe", value: $layer.hdToe, range: 0...0.5, format: "%.2f")
            SliderRow(label: "Gamma", value: $layer.hdGamma, range: 0.3...3.0, format: "%.2f")
            SliderRow(label: "Shoulder", value: $layer.hdShoulder, range: 0...0.5, format: "%.2f")
            SliderRow(label: "Crystal Size", value: $layer.crystalSize, range: 0.05...2.0, format: "%.2f")
        }
    }
}

struct GlobalControls: View {
    @Binding var global: GlobalParams

    var body: some View {
        Section("Global") {
            SliderRow(label: "Reversal", value: $global.reversal, range: 0...1, step: 1, format: "%.0f")
            SliderRow(label: "Stacking", value: $global.stackingStrength, range: 0...1, format: "%.2f")
            SliderRow(label: "DIR", value: $global.dirInhibition, range: 0...1, format: "%.2f")
            SliderRow(label: "Mask Density", value: $global.maskDensity, range: 0...1, format: "%.2f")
            SliderRow(label: "Mask Hue", value: $global.maskHue, range: 0...60, format: "%.0f")
            SliderRow(label: "Tint R", value: $global.baseTintR, range: 0.8...1.0, format: "%.2f")
            SliderRow(label: "Tint G", value: $global.baseTintG, range: 0.8...1.0, format: "%.2f")
            SliderRow(label: "Tint B", value: $global.baseTintB, range: 0.8...1.0, format: "%.2f")
        }
    }
}

struct SliderRow: View {
    let label: String
    @Binding var value: Float
    let range: ClosedRange<Float>
    var step: Float? = nil
    let format: String

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 100, alignment: .leading)
            Slider(value: $value, in: range, step: step ?? ((range.upperBound - range.lowerBound) / 200))
            Text(String(format: format, value))
                .frame(width: 60, alignment: .trailing)
                .monospacedDigit()
        }
    }
}
