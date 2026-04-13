import CoreImage

struct ImageDecoder {
    /// Decode JPG/PNG from a file URL, applying EXIF orientation
    static func decode(url: URL) -> CIImage? {
        guard var image = CIImage(contentsOf: url) else { return nil }
        if let orientation = image.properties[kCGImagePropertyOrientation as String] as? UInt32,
           let ciOrientation = CGImagePropertyOrientation(rawValue: orientation) {
            image = image.oriented(ciOrientation)
        }
        return image
    }

    /// Decode RAW/DNG (stretch goal — stub)
    static func decodeRAW(url: URL) -> CIImage? {
        // TODO: Implement with CIRAWFilter for ProRAW/DNG support
        return nil
    }
}
