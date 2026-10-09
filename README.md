# Velvet Party HUD

Módulo independiente para Foundry VTT 14: HUD lateral de jugadores y NPCs, con retratos, vida, iniciativa, CA, velocidad y condiciones. Reutiliza las placas y las acciones rápidas de VN Dialogues Enhanced sin requerir ese módulo. Puede convivir con Velvet Epic Turns.

## Activación

Instala desde el manifiesto: https://github.com/gmredvelvet-rgb/velvet-party-hud/releases/latest/download/module.json

Requiere **Velvet License Hub 2.0.0 o posterior**, que Foundry solicitará como dependencia.

Reinicia Foundry para detectar el módulo nuevo y actívalo en **Manage Modules → Velvet Party HUD**. Configura sus opciones en **Settings → Velvet Party HUD**.

Por defecto combina los combatientes de la escena actual, el reparto guardado de VND y los personajes con dueño jugador. Los NPCs de toda la biblioteca no se añaden automáticamente. Los combatientes ocultos no aparecen a los jugadores.

El GM puede usar **Configurar grupo**, desde Settings o el botón de añadir del encabezado, para elegir actores o tokens de la escena y asignarlos a Jugadores o NPCs. En Settings, el origen **Manual** muestra únicamente esta selección. Los actores de tokens no vinculados conservan su vida y sus acciones independientes. Quitar un actor en el editor lo excluye también de la detección automática; añadirlo de nuevo lo restaura.

## Disposición

- Arrastra el encabezado de cada panel para moverlo por la pantalla.
- Arrastra su borde derecho para cambiar el ancho de las barras.
- La flecha del encabezado minimiza el panel entero y permite expandirlo de nuevo.
- La pequeña flecha de cada personaje pliega su barra de estadísticas y deja visible el retrato, que conserva el acceso a acciones.
- Arrastra el pequeño agarre del retrato sobre otra tarjeta para reordenar el panel.
- El encabezado y el borde de tamaño también se ajustan con las flechas del teclado; Shift aumenta el paso.

Posición, ancho, orden, barras plegadas, paneles minimizados, visibilidad y tema se guardan por navegador. Las actualizaciones de vida y combate mantienen esta disposición. **Restablecer disposición** devuelve los dos paneles a su estado inicial. Las listas largas se desplazan verticalmente y los paneles se ajustan a los bordes al cambiar el tamaño de la pantalla.

## Acciones rápidas

Clic o clic derecho sobre el retrato/barra abre sólo estas cinco opciones:

1. **Actions / Acciones**.
2. **Spells / Conjuros**.
3. **Feats / Dotes**.
4. **Items / Objetos**.
5. **Open character sheet / Abrir ficha del personaje**.

Las categorías vacías se muestran desactivadas. El dueño y el GM pueden ejecutar acciones; una ficha ajena requiere permiso de observador. PF2e/SF2e conserva strikes, variantes MAP y lanzamiento mediante la entrada de conjuros; D&D 5e usa actividades y `item.use`. Las otras acciones siguen el método nativo del ítem. Los ítems reales se pueden arrastrar desde el popup a la barra de macros. La ventana de acciones conserva pestañas y filtros, admite Enter/Espacio en sus entradas y se cierra con Escape.

## Estilos

- **Clásico**: retratos hexagonales, marco dorado, barras brillantes y placa de iniciativa de VND.
- **D. Dungeon**: hierro oscuro, bordes angulares, pergamino, rojo sangre y barras segmentadas.
- **Velvet Eclipse**: nuevo estilo con retratos circulares, placas de obsidiana azulada, detalles plata/violeta, nombres más legibles y superficies limpias.

El tema es personal y también se aplica al menú y a la ventana de acciones rápidas. La vida cambia de color según su proporción y los enemigos mantienen el rojo. El personaje activo se destaca; los derrotados se atenúan.

## Integración

**Reemplazar HUD lateral de VND** oculta sus paneles para evitar duplicados y libera sus columnas en el diseño clásico. No modifica archivos ni datos de VND, ni afecta al tracker de Velvet Epic Turns. Desactivar Party HUD restaura los paneles originales. Puedes desactivar la integración si quieres conservar ambos.

El GM y los dueños ven las cifras de vida. La opción global **Mostrar números de vida a todos** permite revelarlas a otros usuarios, incluidos los NPCs; por defecto está desactivada. Los demás usuarios ven la proporción de la barra.

## Soft gate y Patreon

Como VND Enhanced, el HUD mantiene **todas sus funciones disponibles sin suscripción**. Registra su propio ID `velvet-party-hud` en Velvet License Hub 2 y utiliza su tarjeta y recordatorios compartidos. El GM conecta Patreon desde **Settings → Velvet License Hub**; la cobertura del HUD se incluye en los niveles Basic y Premium. Una conexión ya existente requiere que el Hub renueve su licencia para recoger el nuevo módulo.

No almacena tokens de Patreon ni hace peticiones de autenticación por su cuenta. Si el Hub no está disponible, el GM recibe un recordatorio a los 8 segundos y cada 10 minutos, que desaparece a los 30 segundos o al cerrarlo. Los jugadores no reciben este aviso local. Los avisos nunca bloquean las acciones ni la disposición. Con el Hub operativo se utiliza exclusivamente su tarjeta compartida.

API pública: `game.modules.get("velvet-party-hud").api.isLicensed()` consulta la cobertura del HUD, y `.openLicense()` abre la tarjeta del Hub para el GM.

## Publicación

`npm test` y `npm run build` validan y generan `dist/module.zip`, `dist/module.json` y sus hashes. El ZIP contiene sólo archivos de ejecución y documentación, sin pruebas, credenciales ni capturas. Para otra versión, actualiza `module.json`, `package.json`, la URL `download` y `CHANGELOG.md`; publica una etiqueta `vX.Y.Z`. El workflow Release comprueba la versión y publica los tres archivos.

## Verificación

`node --test tests/*.test.mjs` comprueba grupo, combatientes ocultos, actores sintéticos, estadísticas, límites de pantalla y clasificación/ejecución de acciones PF2e y 5e.

`node tests/browser-smoke.mjs` usa Playwright para probar el código real con APIs de Foundry simuladas: las cinco acciones, colapso, movimiento, tamaño, persistencia, orden, permisos y temas. Define `PLAYWRIGHT_PATH` si Playwright está instalado fuera del proyecto y, opcionalmente, `PLAYWRIGHT_CHANNEL=msedge` o `chrome`. Guarda capturas en `tests/artifacts/`.

Estas pruebas no sustituyen una partida de prueba en tu mundo real con todos sus módulos activos.

Placas y acciones rápidas adaptadas de VN Dialogues Enhanced. Copyright (c) 2024–2025 GM RedVelvet / The GM Studio. Se conserva su licencia en `LICENSE`.
