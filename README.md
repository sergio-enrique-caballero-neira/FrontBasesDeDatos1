# Front de la ferretería

Interfaz en Angular 22 del sistema de la cadena de ferreterías (proyecto de Bases de Datos 1). Por ahora funciona sola, con datos de demostración guardados en el navegador; el back se conecta después.

## Ejecutar

```bash
npm install
npm start
```

Abre `http://localhost:4200`. En la pantalla de inicio de sesión hay dos accesos de demostración: administrador (Laura Gómez) y vendedor (Camila Rojas).

```bash
npm test         # pruebas unitarias (Vitest)
npm run build    # build de producción en dist/
```

## Qué hay

| Rol | Pantallas |
|-----|-----------|
| Ambos | Inicio, Ventas (historial y factura), Clientes, Inventario |
| Vendedor | Nueva venta: carrito con el stock de la sucursal, cliente, método de pago |
| Administrador | Productos, Proveedores, Suministros, Evaluaciones de calidad, Sucursales, Empleados, Marcas, Categorías, Métodos de pago |

La sucursal de trabajo se elige después de iniciar sesión y se cambia desde la barra superior. El administrador puede ver todas a la vez.

## Estructura

```
src/app/
  core/       modelos (una interfaz por tabla), sesión, guards, avisos
  data/       base de datos simulada (localStorage), datos semilla y repositorios
  shared/     componentes reutilizables: estados de carga/vacío/error, diálogos, formato
  layout/     barra lateral y barra superior
  features/   una carpeta por pantalla, cargada de forma diferida
```

## Conectar el back

Los componentes nunca leen datos directamente: todo pasa por los repositorios de `src/app/data`, cuyos métodos son asíncronos y tienen la forma que tendrá la API. Para conectar el back:

1. Reemplaza el cuerpo de cada método del repositorio por la llamada HTTP equivalente (`HttpClient` + `firstValueFrom`).
2. Mueve al back las reglas que hoy simula el front y que están marcadas en el código: stock suficiente y descuento de inventario al vender (`VentasRepository.registrar`), restricciones de llave foránea al borrar (`asegurarSinReferencias`), claves únicas y el stock total del producto (`recalcularStock`).
3. Cambia `Session.iniciarSesion` por la autenticación real.
4. Borra `mock-db.ts` y `seed.ts`.

## Cambios al modelo que el front asume

Ver `docs/specs/2026-10-24-front-ferreteria-design.md` en la raíz del proyecto: `DETALLE_VENTA`, `METODO_PAGO` como catálogo, y `SUMINISTRAR` separado de `EVALUACION`.

## Diseño

La dirección visual está en `DESIGN.md`, en la raíz del proyecto. Excepciones acordadas: el rojo `#e7000b` es el acento de marca y solo aparece en el nombre y en las acciones de vender; los radios marcan jerarquía (píldora en botones y etiquetas, 10 px en campos, 24 px en tarjetas).

Hay modo claro y oscuro (botón de luna o sol en la barra superior y en el login). Es una preferencia del navegador, no del usuario: se mantiene al cambiar de administrador a vendedor y se sincroniza entre pestañas abiertas. La primera vez sigue la preferencia del sistema operativo. Los colores de cada modo están en `src/styles.scss`, en los bloques `[data-bs-theme='light']` y `[data-bs-theme='dark']`. La factura siempre se imprime en claro.
