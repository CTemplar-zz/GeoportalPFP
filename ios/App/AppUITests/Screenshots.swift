import XCTest

final class Screenshots: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "org.howwe.geoportal")

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launchArguments = ["-AppleLanguages", "(es)", "-AppleLocale", "es_BO"]
        app.launch()
    }

    private func button(_ text: String, exact: Bool = false) -> XCUIElement? {
        let predicate = NSPredicate(format: exact ? "label == %@" : "label CONTAINS[c] %@", text)
        return (app.buttons.matching(predicate).allElementsBoundByIndex +
                app.switches.matching(predicate).allElementsBoundByIndex)
            .first(where: { $0.exists && $0.isHittable })
    }

    private func tap(_ text: String, exact: Bool = false, scroll: Bool = false) throws {
        for _ in 0..<(scroll ? 14 : 60) {
            if let element = button(text, exact: exact) { element.tap(); return }
            if scroll { swipeContent(up: true) } else { Thread.sleep(forTimeInterval: 1) }
        }
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "accessibility-failure-\(text)"
        tree.lifetime = .keepAlways
        add(tree)
        capture("diagnostico-control-ausente", wait: 0)
        XCTFail("No se encontró el control visible: \(text)")
        throw NSError(domain: "Screenshots", code: 1)
    }

    private func swipeContent(up: Bool) {
        let a = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: up ? 0.82 : 0.40))
        let b = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: up ? 0.40 : 0.82))
        a.press(forDuration: 0.1, thenDragTo: b)
        Thread.sleep(forTimeInterval: 1)
    }

    private func capture(_ name: String, wait: TimeInterval = 2) {
        Thread.sleep(forTimeInterval: wait)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "PFP-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testAppStoreIPad() throws {
        try tap("Explorar el mapa")
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
        capture("08-ipad-mapa", wait: 30)
    }

    func testAppStorePortrait() throws {
        try tap("Explorar el mapa")
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
        capture("01-mapa", wait: 20)

        try tap("Capas", exact: true)
        capture("02-modulos")
        try tap("Datos INE", scroll: true)
        try tap("Marco espacial")
        try tap("Cuencas Hidrográficas (Nivel 3)", exact: true)
        capture("03-grupos-capas", wait: 12)
        try tap("Cerrar panel", exact: true)

        try tap("Activas")
        capture("04-capas-activas")
        try tap("Cerrar panel", exact: true)
        try tap("Mapas base", exact: true)
        capture("05-mapas-base", wait: 8)
        try tap("Cerrar panel", exact: true)

        try tap("Datos", exact: true)
        try tap("Por cuenca", exact: true)
        var selected = false
        for _ in 0..<14 {
            let rows = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ AND NOT label CONTAINS[c] %@", "Nivel 3", "Sin ficha")).allElementsBoundByIndex
            if let row = rows.first(where: { $0.isHittable }) { row.tap(); selected = true; break }
            swipeContent(up: true)
        }
        XCTAssertTrue(selected, "Debe seleccionarse una cuenca con ficha INE real")
        // Return the sheet to its KPI header after selecting the basin.
        for _ in 0..<8 { swipeContent(up: false) }
        capture("06-datos-cuenca", wait: 5)
        swipeContent(up: true)
        capture("07-indicadores-cuenca")
    }
}
