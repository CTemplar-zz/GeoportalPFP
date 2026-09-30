# Configuración de Codemagic

Preparado el 30 de septiembre de 2026. Proyecto Capacitor 8, Swift Package Manager; no requiere CocoaPods ni Android Studio.

## Importar y firmar

1. Añade la app desde `CTemplar-zz/GeoportalPFP`. Elige `main` y la configuración YAML del repositorio.
2. En Team settings → Code signing identities, incorpora el certificado Apple Distribution (incluida su clave privada) y el perfil de distribución App Store para `org.howwe.geoportal`. Deben coincidir en equipo Apple y certificado.
3. Si prefieres obtenerlos desde Apple mediante la integración de Codemagic, configura la clave App Store Connect en la sección segura Team integrations. No la añadas al YAML, al repositorio ni a una captura pública.
4. Ejecuta **ios-app-store** manualmente. Codemagic recupera los materiales que coincidan con `distribution_type: app_store` y `bundle_identifier: org.howwe.geoportal`; `xcode-project use-profiles` los aplica al proyecto.

No revoques certificados de otras apps para configurar esta. No se crearon ni cargaron credenciales durante la preparación del repositorio.

## Compilación para simulador de iPhone

## Capturas nativas para App Store

El flujo **ios-screenshots** ejecuta XCUITest en un iPhone 13 Pro Max nuevo en cada build. Genera siete PNG verticales nativos de **1284 × 2778**, aceptados en el espacio de iPhone 6,5 pulgadas indicado por App Store Connect, y un ZIP descargable. Las imágenes no se redimensionan ni se recortan; el script verifica sus dimensiones y exporta PNG sin canal alfa. Incluye mapa, módulos, grupo M8, capas activas, mapas base, datos de una cuenca con ficha real e indicadores. Revisa visualmente los mapas y datos antes de subirlas. No activa App Preview ni carga capturas a Apple. Si falla la navegación o la resolución, el build falla y conserva los adjuntos y logs para diagnóstico.

## Uso del simulador

Ejecuta manualmente **ios-simulator** sobre `main`. Genera `App.app` para iPhoneSimulator y `Geoportal-PFP-iPhone-Simulator.zip`, además del log de Xcode. No utiliza certificados, no modifica el IPA firmado y no sube nada a Apple. El ZIP contiene la app preparada para un simulador iOS en Mac o un servicio compatible; no se instala en un iPhone físico. App Preview interactivo es una función aparte de Codemagic y no se activa ni contrata con este flujo. Este workflow compila la app; todavía no automatiza capturas.

## Resultado de distribución y límites

Al terminar correctamente se espera un IPA en `build/ios/ipa/`, disponible en los artefactos de Codemagic. Los logs de Xcode también se conservan como artefactos. El workflow no contiene `publishing` ni disparadores de ejecución automática: no sube el IPA a Apple ni envía una revisión.

Usa una imagen estable de Xcode compatible con los requisitos vigentes de Apple (Capacitor 8 requiere al menos Xcode 26). Se utiliza `xcode: latest` para la imagen estable de Codemagic, no `edge`.

El build está fijado inicialmente en 2. Antes de una nueva carga de la misma versión, incrementa `CURRENT_PROJECT_VERSION` en las configuraciones Debug y Release de `ios/App/App.xcodeproj/project.pbxproj`. Si cambias la versión comercial, actualiza `MARKETING_VERSION`, `package.json` y su comprobación en `scripts/verify-ios.mjs`.

La compilación web y sincronización pueden verificarse en Windows, pero el IPA firmado solo se confirma con un build macOS exitoso. La primera ejecución puede requerir ajustes de firma propios de la cuenta; no se ha iniciado una compilación de pago ni probado este workflow en Codemagic.

## Comprobaciones antes de publicar

- Probar el IPA con los canales apropiados de Apple/TestFlight y validar ubicación, compartir archivos y servicios externos desde iOS.
- Completar la ficha, política de privacidad pública, soporte, clasificación y capturas contrastadas con la app nativa.
- Revisar las condiciones de uso/redistribución de datos y mapas. La distribución pública de la app no exige dar acceso a terceros al proyecto en App Store Connect.

Documentación oficial: [firma iOS](https://docs.codemagic.io/yaml-code-signing/signing-ios/), [compilación iOS nativa](https://docs.codemagic.io/yaml-quick-start/building-a-native-ios-app/).
