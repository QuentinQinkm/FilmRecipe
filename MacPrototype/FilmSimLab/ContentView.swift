import SwiftUI
import CoreImage
import UniformTypeIdentifiers

struct ContentView: View {
    @State private var sourceImage: CIImage?
    @State private var recipe: Recipe = StockTemplates.portra400
    @State private var selectedTemplate: String = "Portra 400"
    @State private var isDragOver = false

    var body: some View {
        HSplitView {
            // Image canvas
            ZStack {
                Color.black
                if sourceImage != nil {
                    ImageCanvas(sourceImage: sourceImage, recipe: recipe)
                } else {
                    Text("Drop an image here\nor click to open")
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $isDragOver) { providers in
                loadDrop(providers: providers)
            }
            .onTapGesture { openFile() }
            .frame(minWidth: 400, minHeight: 300)

            // Controls sidebar
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Film Stock", selection: $selectedTemplate) {
                        ForEach(StockTemplates.all) { template in
                            Text(template.name).tag(template.name)
                        }
                    }
                    .onChange(of: selectedTemplate) { _, newValue in
                        if let t = StockTemplates.all.first(where: { $0.name == newValue }) {
                            recipe = t
                        }
                    }

                    ForEach(recipe.layers.indices, id: \.self) { i in
                        LayerControls(layer: $recipe.layers[i], index: i)
                    }

                    GlobalControls(global: $recipe.global)
                }
                .padding()
            }
            .frame(width: 320)
        }
        .frame(minWidth: 800, minHeight: 500)
    }

    private func openFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.jpeg, .png]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            sourceImage = ImageDecoder.decode(url: url)
        }
    }

    private func loadDrop(providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
            guard let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) else { return }
            DispatchQueue.main.async {
                sourceImage = ImageDecoder.decode(url: url)
            }
        }
        return true
    }
}
