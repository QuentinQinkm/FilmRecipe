import CoreImage

struct ImageDecoder {
    /// Decode JPG/PNG from a file URL
    static func decode(url: URL) -> CIImage? {
        return CIImage(contentsOf: url)
    }

    /// Decode RAW/DNG (stretch goal — stub)
    static func decodeRAW(url: URL) -> CIImage? {
        // TODO: Implement with CIRAWFilter for ProRAW/DNG support
        return nil
    }
}
