/**
 * Config plugin: adota o ciclo de vida UIScene no app nativo iOS.
 *
 * Os SDKs recentes do iOS (26/27+) EXIGEM que o app use UIScene — sem isso o
 * sistema mata o app no launch ("UIScene life cycle is required for apps built
 * with this SDK"). O template padrão do Expo/React Native ainda cria a janela
 * no AppDelegate (modelo antigo), então este plugin:
 *
 *   1. injeta o UIApplicationSceneManifest no Info.plist apontando para uma
 *      SceneDelegate;
 *   2. reescreve o AppDelegate.swift para subir o React Native dentro da cena.
 *
 * Como a pasta ios/ é regenerada pelo prebuild/EAS, a correção precisa viver
 * aqui para sobreviver a cada build.
 */
const { withInfoPlist, withAppDelegate } = require('@expo/config-plugins');

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

const SCENE_DELEGATE_CLASS = `
/// Ciclo de vida UIScene: cria a janela do app e sobe o React Native nela.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: appDelegate.launchOptions)
    window.makeKeyAndVisible()
    self.window = window
    if let url = connectionOptions.urlContexts.first?.url {
      RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}
`;

const CONFIG_METHOD = `
  public func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
`;

function patchAppDelegate(contents) {
  if (contents.includes('class SceneDelegate')) return contents; // idempotente

  if (!/^import UIKit$/m.test(contents)) {
    contents = contents.replace(
      /import ReactAppDependencyProvider/,
      'import ReactAppDependencyProvider\nimport UIKit'
    );
  }

  // guarda as launchOptions para a cena usar
  contents = contents.replace(
    /(var reactNativeFactory: RCTReactNativeFactory\?)/,
    '$1\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?'
  );

  // a janela deixa de ser criada aqui — passa para a SceneDelegate
  contents = contents.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif/m,
    'self.launchOptions = launchOptions'
  );

  // injeta o método de configuração de cena após o didFinishLaunching
  contents = contents.replace(
    /(return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)\s*\n\s*\})/,
    `$1\n${CONFIG_METHOD}`
  );

  // adiciona a classe SceneDelegate antes da ReactNativeDelegate
  contents = contents.replace(
    /(class ReactNativeDelegate)/,
    `${SCENE_DELEGATE_CLASS}\n$1`
  );

  return contents;
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return cfg;
  });
  config = withAppDelegate(config, (cfg) => {
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });
  return config;
};
