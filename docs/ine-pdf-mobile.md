# PDF INE en las aplicaciones móviles

## Corrección del 2 de octubre de 2026

El Worker rechazaba los orígenes locales de Capacitor con HTTP 403 `ORIGIN_NOT_ALLOWED`. El preflight devolvía el origen de GitHub Pages, de modo que Android y WKWebView ocultaban la respuesta y mostraban `Failed to fetch` / `Load failed`.

Se añadieron `https://localhost`, `http://localhost` y `capacitor://localhost` tanto a los valores predeterminados como a `ALLOWED_ORIGINS` en la configuración del despliegue. La corrección del servidor se aplica también a las instalaciones existentes. Los sitios externos siguen rechazados.

El módulo 8 entrega ahora el Blob generado directamente a `MobileNative.saveBlob`. El puente escribe los bytes en `Directory.Cache` y abre el selector nativo de guardar/compartir. El panel espera esa operación, muestra los errores y permite reintentar. La versión web conserva la descarga mediante enlace. También se corrigió la lectura de errores HTTP que no contienen JSON.

## Verificación reproducible

```powershell
node --test cloudflare/ine-report-worker/test/origins.test.js
node --test scripts/test-native-save.mjs
npm run sync
npm run verify:ios
npm test -- tests/ine-report.spec.js
$env:PFP_TEST_PORT='4176'
npx playwright test --config=playwright.android.config.js tests/ine-report.spec.js
```

Las pruebas del puente sustituyen Filesystem y Share; las pruebas de interfaz sustituyen la respuesta INE. No equivalen a abrir el selector en un dispositivo real.

Se comprobó adicionalmente el servicio publicado con tres códigos rurales de El Palmar (`04348321695-D`, `04374598843-D`, `04379976607-D`): Android e iOS recibieron HTTP 200, `application/pdf`, firma `%PDF`, 95.178 bytes, 564 personas y 200 viviendas.

Worker publicado: versión `0b476853-b2e3-4f6b-9dcf-ed76f31d2935` en `https://geoportal-ine-pdf.geoportal-ine-pdf.workers.dev`.

## Entregas

Android: versión 0.1.2, código 3, APK de prueba firmado con la configuración debug existente. iPhone/iPad: versión 1.0, compilación 6 mediante el flujo `ios-app-store` de Codemagic. Ese flujo sube el IPA a Apple y no envía la app a revisión automáticamente.

## Comprobación en el dispositivo

1. Abrir el módulo 8 y seleccionar comunidades/manzanas con rectángulo, polígono o AP filtradas.
2. Pulsar **Verificar con INE** y después **Generar y descargar PDF**.
3. En iPhone/iPad, elegir **Guardar en Archivos** en el selector; en Android, elegir un destino disponible o una aplicación para compartir.
4. Abrir el PDF guardado y revisar el ámbito seleccionado. Repetir con una selección diferente.
5. Comprobar el mensaje de error sin conexión y reintentar después de recuperar la conexión.

No hay dispositivos Android conectados por ADB; la comprobación del selector y del guardado físico queda pendiente de realizar en el teléfono/iPad.
