import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Use this method to optionally configure and attach the UIWindow to the provided UIWindowScene.
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let window = UIWindow(windowScene: windowScene)
        let mainStoryboard = UIStoryboard(name: "Main", bundle: nil)
        let initialVC = mainStoryboard.instantiateInitialViewController()
        window.rootViewController = initialVC
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Forward URL opens to Capacitor's ApplicationDelegateProxy
        for context in URLContexts {
            let _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: context.url,
                options: [
                    .openInPlace: context.options.openInPlace,
                    .sourceApplication: context.options.sourceApplication as Any
                ]
            )
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Forward Universal Links to Capacitor's ApplicationDelegateProxy
        let _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
