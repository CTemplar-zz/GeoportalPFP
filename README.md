# Geoportal PFP · iPhone e iPad

Aplicación iOS basada en Capacitor y Leaflet, con mapa a pantalla completa, nueve módulos temáticos, capas por grupos, orden de superposición, indicadores INE y descarga de fichas de cuencas.

Actualización del 2 de octubre de 2026: versión 1.0 (5), target universal iPhone/iPad y paneles adaptables a rotación y ventanas estrechas. En pantallas amplias se puede interactuar con el mapa mientras se consultan capas e indicadores. `tests/adaptive.spec.js` cubre estas interacciones.

## Compilar con Codemagic

1. En Codemagic, conecta este repositorio y selecciona la rama `main`.
2. Usa la configuración `codemagic.yaml` de la raíz y el workflow **ios-app-store**.
3. En la configuración segura del equipo de Codemagic, añade un certificado **Apple Distribution** con su clave privada y un perfil **App Store** para `org.howwe.geoportal`, del mismo equipo Apple. Consulta [docs/CODEMAGIC.md](docs/CODEMAGIC.md).
4. Ejecuta el workflow manualmente. Instala dependencias, genera recursos, sincroniza iOS y compila el IPA firmado.
5. Descarga el IPA de los artefactos cuando la compilación termine correctamente.

El repositorio no contiene certificados, claves API ni perfiles. El workflow usa la integración existente **Codemagic iOS Build** y las identidades de firma configuradas en Codemagic. Sube el IPA a App Store Connect; no lo envía automáticamente a revisión de App Store ni beta y no se ejecuta con cada push. Tras el procesamiento en Apple, la compilación se habilita en el grupo interno de TestFlight.

## Desarrollo local

Node.js 22 o superior:

```sh
npm ci
npm run icons
npm run sync
npm run verify:ios
```

En una Mac con Xcode 26 o superior:

```sh
npm run ios
```

También puedes ejecutar `bash Preparar_en_Mac.command`. El proyecto nativo está en `ios/App/App.xcodeproj`, esquema compartido `App`, Archive en Release, mínimo iOS 15, familia de dispositivo iPhone. Identificador: `org.howwe.geoportal`. Versión inicial del proyecto: 0.1.1, build 2. Aumenta el build antes de repetir una carga de esa versión a Apple.

## Pruebas de interfaz

```sh
npx playwright install webkit
npm test
```

Las pruebas inician su propio servidor en el puerto 4175 (configurable mediante `PFP_TEST_PORT`). WebKit de escritorio no sustituye las pruebas de WKWebView, ubicación, archivos, conectividad y rendimiento en un iPhone real.

## Recursos y repositorio

- `src/`: interfaz móvil y funciones nativas.
- `source/geoportal.html`: motor del geoportal y paneles.
- `source/assets/`: recursos locales incluidos en la app, incluidas fichas PDF y Excel INE.
- `source/remote-assets.json`: rutas de recursos cartográficos grandes que se consultan en el geoportal existente.
- `resources/`: iconos e ilustración; procedencia en `docs/ASSETS.md`.
- `ios/`: código nativo y proyecto de Xcode.
- `scripts/`: generación reproducible y comprobación estática de la entrega.

Los mapas base, WMS, reportes externos y grandes capas remotas requieren conexión. `npm run build` genera `build-report.json` con el inventario. Los recursos remotos no se descargan durante el build y no necesitan Git LFS. La app no sincroniza automáticamente sus datos con carpetas SIG.

No se incluyen dependencias instaladas, ZIP de entrega, capturas de cuentas Apple, contactos privados, borradores de políticas ni credenciales. `www/` y los recursos web del proyecto iOS se reconstruyen mediante `npm run sync`.

Las marcas, datos y bibliotecas conservan sus atribuciones y condiciones originales; la presencia en este repositorio no concede derechos adicionales sobre recursos de terceros. Antes de distribuir, el titular debe revisar permisos, privacidad y metadatos de App Store Connect.
