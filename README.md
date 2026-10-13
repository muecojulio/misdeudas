# Mis deudas

Libreta local para compras a meses sin intereses.

- Cuántos pagos van (por ejemplo, 3 de 12), cuánto llevas pagado y cuánto falta.
- El pago mensual lo pones tú y puedes repartir cada compra entre una o más personas.
- Guarda el nombre de una tarjeta y su terminación de cuatro dígitos; nunca el número completo.
- Los datos de las compras se guardan en el almacenamiento local del navegador; la libreta no sincroniza su contenido ni lo guarda en una base de datos remota.
- El publicador puede configurar controles de acceso del sitio por separado. La pestaña **Privacidad** explica el almacenamiento, las conexiones y cómo exportar o borrar los datos.
- La pestaña **QR** muestra un código para abrir la app e instalarla desde el teléfono, la tableta o la computadora.
- Todos los importes se muestran en pesos mexicanos (MXN).

## Servicios públicos

- El calendario de días festivos de México consulta Nager.Date sin clave ni registro. Solo se envían el año y el país; la respuesta se cachea localmente por una semana y hay fechas de respaldo.

Estos servicios no reciben nombres, compras, importes ni terminaciones de tarjeta. Las tasas de cambio son informativas y no representan la tasa ni las comisiones de una entidad bancaria.

## Base de datos e índices

La aplicación no consulta una base de datos relacional; conserva colecciones locales de personas, tarjetas y compras en el navegador. Por ello no hay índices SQL que convenga crear ni una migración de datos de negocio. Los conjuntos están acotados y los resúmenes se derivan en memoria.

## Componentes accesibles

La navegación por pestañas, diálogos, switches y paneles plegables reutilizan los paquetes Radix UI ya presentes en el proyecto. Consulta [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) para su fuente pública y atribución.
