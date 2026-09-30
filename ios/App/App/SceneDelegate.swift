import UIKit
import Capacitor
import WebKit

#if DEBUG
// Diagnostics only: do not change the page or the screenshots.
private final class DiagnosticBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        for delay in [5.0, 20.0, 60.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.webView?.evaluateJavaScript("JSON.stringify({url:location.href,ready:document.readyState,title:document.title,body:document.body?.innerText?.slice(0,500),html:document.documentElement.outerHTML.length,scripts:Array.from(document.scripts).map(s=>s.src).filter(Boolean)})") { value, error in
                    NSLog("GeoportalDiagnostic %@ %@", String(describing: value), String(describing: error))
                }
            }
        }
    }
}
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // UIKit already creates the storyboard window. Reuse it rather than
        // leaving two overlapping Capacitor web views attached to the scene.
        if window == nil { window = UIWindow(windowScene: windowScene) }
        #if DEBUG
        window?.rootViewController = DiagnosticBridgeViewController()
        #else
        window?.rootViewController = CAPBridgeViewController()
        #endif
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
