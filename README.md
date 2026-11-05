# Front de la ferretería

Aplicación web en Angular 22 del sistema de información para una cadena de ferreterías, proyecto final de Bases de Datos 1 (Universidad El Bosque). La usan solo los empleados: vendedores y administradores. Todos los datos vienen de la API del back ([backbases](https://github.com/GrupoTrabajoBasesUEB/backbases)), que trabaja sobre la base MySQL `Proyecto_db`.

En producción está en `https://ferreteria.serbux.qzz.io`.

## Ejecutar

Requiere Node.js 22.22, 24.15 o una versión posterior, como pide Angular 22, y npm.

```bash
npm install
npm start
```

```bash
npm test         # pruebas unitarias con Vitest
npm run build    # build de producción en dist/Front/browser
```

## Qué ve cada rol

| Quién | Pantallas |
|---|---|
| Todos | Inicio, Ventas (historial y factura), Clientes, Inventario |
| Vendedor | Nueva venta: carrito con el stock de su sucursal, cliente y método de pago |
| Administrador, nivel 1 | Lo anterior (sin registrar ventas), más Productos |
| Administrador, nivel 2 | Lo anterior, más Proveedores, Suministros y Evaluaciones de calidad |
| Administrador, nivel 3 | Lo anterior, más Sucursales, Empleados y los catálogos: marcas, categorías y métodos de pago |

El vendedor trabaja siempre en su sucursal. El administrador elige una sucursal después de iniciar sesión, o la vista de todas a la vez, y la puede cambiar desde la barra superior. El menú solo muestra las áreas del nivel de cada administrador, y el back rechaza lo que el nivel no permite. Toda eliminación pide la clave de seguridad del administrador.

## Cómo funciona

- **Sesión:** el login llama a `POST /api/auth/login` y guarda el token en el navegador. Un interceptor lo agrega a cada petición. La sesión dura 8 horas; cuando vence, la siguiente petición recibe 401, la aplicación avisa y pide entrar de nuevo, y luego vuelve a la pantalla donde estaba.
- **Datos:** los componentes no llaman a la API directamente. Cada área tiene un repositorio en `src/app/data` que hace las peticiones y traduce las respuestas del back a los modelos del front.
- **Errores:** cuando el back rechaza una operación, la aplicación muestra el mensaje que él envía; si es un error de validación, muestra el del primer campo que falló. Los formularios validan antes de enviar con las mismas reglas del back.

## Estructura

```
src/app/
  core/       configuración, cliente de la API, sesión, interceptor, guards, modelos y tema
  data/       un repositorio por área, con las peticiones a la API
  shared/     componentes reutilizables: tablas, filtros, diálogos, gráficos, estados de carga, vacío y error
  layout/     barra lateral y barra superior
  features/   una carpeta por pantalla, cargada de forma diferida
```

## Diseño

Bootstrap 5.3, íconos de Font Awesome y la fuente Geist. La interfaz es monocromática; el rojo `#e7000b` es el acento de marca y solo aparece en el nombre y en las acciones de vender. Los radios marcan jerarquía: píldora en botones y etiquetas, 10 px en campos y 24 px en tarjetas.

Hay modo claro y oscuro (botón de luna o sol en la barra superior y en el login). Es una preferencia del navegador, no del usuario: se mantiene al cambiar de sesión y se sincroniza entre pestañas abiertas. La primera vez sigue la preferencia del sistema operativo. Los colores de cada modo están en `src/styles.scss`, en los bloques `[data-bs-theme='light']` y `[data-bs-theme='dark']`. La factura siempre se imprime en claro.

## Despliegue

El sitio se sirve desde Cloudflare Workers como aplicación de una sola página. La configuración está en `wrangler.jsonc`, que publica el contenido de `dist/Front/browser`.
