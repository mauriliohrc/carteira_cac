import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct Acervo: Widget {
  let name: String = "Acervo"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Status do acervo")
    .description("Veja num relance se seus documentos e habitualidade estão em dia.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}